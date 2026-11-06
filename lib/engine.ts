import { MARKETS, market } from "./assets";
import { q } from "./db";
import { paperBuy, paperSell, tokenPrices, type PaperFill } from "./oneclick";
import { equity, publicStats, replay, type Fill, type PublicStats } from "./stats";

export type Trader = {
  handle: string;
  name: string;
  owner: string;
  bio: string;
  style: string;
  markets: string[];
  start_cash: number;
  is_bot: boolean;
  created_at: string;
};

export type StoredFill = Fill & { id: number; account: string; handle: string; price: number; quote: unknown; source_fill: number | null };

export const traderAccount = (handle: string) => `trader:${handle}`;
export const copyAccount = (holder: string, handle: string) => `copy:${holder.toLowerCase()}:${handle}`;

const MIN_TRADE_USDC = 5;

export async function symbolPrices(): Promise<Record<string, number>> {
  const byAsset = await tokenPrices();
  return Object.fromEntries(MARKETS.map((m) => [m.symbol, byAsset[m.assetId] ?? 0]));
}

export async function getTrader(handle: string): Promise<Trader | null> {
  const rows = await q<Trader>("select * from traders where handle = $1", [handle]);
  return rows[0] ?? null;
}

export async function listTraders(): Promise<Trader[]> {
  return q<Trader>("select * from traders order by created_at asc");
}

export async function accountFills(account: string): Promise<StoredFill[]> {
  const rows = await q<Record<string, unknown>>(
    "select id, account, handle, side, symbol, qty, usdc, price, quote, source_fill, created_at from fills where account = $1 order by id asc",
    [account],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    account: String(r.account),
    handle: String(r.handle),
    side: r.side as "buy" | "sell",
    symbol: String(r.symbol),
    qty: Number(r.qty),
    usdc: Number(r.usdc),
    price: Number(r.price),
    quote: r.quote,
    source_fill: r.source_fill == null ? null : Number(r.source_fill),
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));
}

export async function equitySeries(account: string, limit = 500): Promise<{ ts: string; value: number }[]> {
  const rows = await q<{ ts: string; value: number }>(
    "select ts, value from (select ts, value from equity where account = $1 order by ts desc limit $2) s order by ts asc",
    [account, limit],
  );
  return rows.map((r) => ({ ts: new Date(r.ts).toISOString(), value: Number(r.value) }));
}

export async function accountStats(account: string, startCash: number, prices?: Record<string, number>): Promise<PublicStats> {
  const [fills, series, px] = await Promise.all([accountFills(account), equitySeries(account), prices ?? symbolPrices()]);
  return publicStats(startCash, fills, px, series.map((s) => s.value));
}

async function recordFill(account: string, handle: string, f: PaperFill, sourceFill: number | null): Promise<number> {
  const rows = await q<{ id: number }>(
    "insert into fills (account, handle, side, symbol, qty, usdc, price, quote, source_fill) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
    [account, handle, f.side, f.asset.symbol, f.qty, f.usdc, f.price, JSON.stringify(f.quote), sourceFill],
  );
  return Number(rows[0].id);
}

export async function snapshot(account: string, startCash: number, prices: Record<string, number>): Promise<number> {
  const book = replay(startCash, await accountFills(account));
  const v = equity(book, prices);
  await q("insert into equity (account, value) values ($1, $2)", [account, v]);
  return v;
}

export type TradeOrder = { side: "buy"; symbol: string; usdc: number } | { side: "sell"; symbol: string; fraction: number };

export type TradeResult = { fillId: number; fill: PaperFill; mirrored: number; skipped: number };

/**
 * Executes a paper trade at a live, signature-verified 1Click dry quote, then mirrors it
 * proportionally into every active blind-copy account for this trader.
 */
export async function trade(trader: Trader, order: TradeOrder): Promise<TradeResult> {
  if (!trader.markets.includes(order.symbol) && !MARKETS.some((m) => m.symbol === order.symbol)) throw new Error("unknown market");
  const asset = market(order.symbol);
  const account = traderAccount(trader.handle);
  const prices = await symbolPrices();
  const book = replay(trader.start_cash, await accountFills(account));
  const eqBefore = equity(book, prices);
  let fill: PaperFill;
  let fraction: number;
  if (order.side === "buy") {
    const usdc = Math.min(order.usdc, book.cash);
    if (usdc < MIN_TRADE_USDC) throw new Error("not enough paper cash");
    fill = await paperBuy(asset, usdc);
    fraction = usdc / eqBefore;
  } else {
    const held = book.positions[order.symbol]?.qty ?? 0;
    const qty = held * Math.min(Math.max(order.fraction, 0), 1);
    if (qty * (prices[order.symbol] ?? 0) < 0.5) throw new Error("no position to sell");
    fill = await paperSell(asset, qty);
    fraction = qty / held;
  }
  const fillId = await recordFill(account, trader.handle, fill, null);
  await snapshot(account, trader.start_cash, prices);
  const { mirrored, skipped } = await mirror(trader, order.side, order.symbol, fraction, fillId, prices);
  return { fillId, fill, mirrored, skipped };
}

async function mirror(
  trader: Trader,
  side: "buy" | "sell",
  symbol: string,
  fraction: number,
  sourceFill: number,
  prices: Record<string, number>,
): Promise<{ mirrored: number; skipped: number }> {
  const subs = await q<{ holder: string; allocation: number }>(
    "select holder, allocation from passes where handle = $1 and tier = 'copy' and expires_at > now()",
    [trader.handle],
  );
  let mirrored = 0;
  let skipped = 0;
  const asset = market(symbol);
  for (const s of subs) {
    const account = copyAccount(s.holder, trader.handle);
    const start = Number(s.allocation);
    try {
      const book = replay(start, await accountFills(account));
      const eq = equity(book, prices);
      let f: PaperFill;
      if (side === "buy") {
        const usdc = Math.min(eq * fraction, book.cash);
        const guard = riskGuard(book.positions[symbol]?.qty ?? 0, prices[symbol] ?? 0, usdc, eq);
        if (guard) throw new SkipError(guard);
        f = await paperBuy(asset, usdc);
      } else {
        const qty = (book.positions[symbol]?.qty ?? 0) * fraction;
        if (qty * (prices[symbol] ?? 0) < 0.5) throw new SkipError("no mirrored position to sell");
        f = await paperSell(asset, qty);
      }
      await recordFill(account, trader.handle, f, sourceFill);
      await snapshot(account, start, prices);
      mirrored++;
    } catch (e) {
      skipped++;
      await q("insert into skipped_copies (account, source_fill, reason) values ($1,$2,$3)", [
        account,
        sourceFill,
        e instanceof Error ? e.message.slice(0, 200) : "error",
      ]);
    }
  }
  return { mirrored, skipped };
}

class SkipError extends Error {}

/** Follower-side guard: skip copies that are too small or would put over 60% of the account in one asset. */
export function riskGuard(heldQty: number, price: number, usdc: number, equityNow: number): string | null {
  if (usdc < MIN_TRADE_USDC) return `copy size $${usdc.toFixed(2)} is below the $${MIN_TRADE_USDC} minimum`;
  if (equityNow > 0 && (heldQty * price + usdc) / equityNow > 0.6) return "would exceed 60% of the account in one asset";
  return null;
}

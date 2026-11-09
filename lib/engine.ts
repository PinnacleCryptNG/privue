import { MARKETS, market } from "./assets";
import { q } from "./db";
import { enqueueMirrors } from "./jobs";
import { GENESIS, fillAad, leafHash, open, seal, type FillBody } from "./ledger";
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

export type StoredFill = Fill & {
  id: number;
  seq: number;
  hash: string;
  account: string;
  handle: string;
  price: number;
  quote: FillBody["quote"];
  source_fill: number | null;
};

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

/** Decrypts an account's sealed fills in chain order. */
export async function accountFills(account: string): Promise<StoredFill[]> {
  const rows = await q<{ id: string; seq: string; hash: string; account: string; handle: string; sealed: string; source_fill: string | null }>(
    "select id, seq, hash, account, handle, sealed, source_fill from fills where account = $1 order by seq asc",
    [account],
  );
  return rows.map((r) => {
    const id = Number(r.id);
    const body = open(r.sealed, fillAad(id));
    return {
      id,
      seq: Number(r.seq),
      hash: r.hash,
      account: r.account,
      handle: r.handle,
      side: body.side,
      symbol: body.symbol,
      qty: body.qty,
      usdc: body.usdc,
      price: body.price,
      quote: body.quote,
      source_fill: r.source_fill == null ? null : Number(r.source_fill),
      createdAt: body.createdAt,
    };
  });
}

export async function getFill(id: number): Promise<StoredFill | null> {
  const [r] = await q<{ account: string }>("select account from fills where id = $1", [id]);
  if (!r) return null;
  return (await accountFills(r.account)).find((f) => f.id === id) ?? null;
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

/**
 * Seals the fill and appends it to the account's hash chain in one statement. The chain link is
 * computed by Postgres from the current head, and the (account, seq) unique index turns a race
 * into a retry instead of a fork.
 */
export async function recordFill(account: string, handle: string, f: PaperFill, sourceFill: number | null): Promise<number> {
  const body: FillBody = {
    side: f.side,
    symbol: f.asset.symbol,
    qty: f.qty,
    usdc: f.usdc,
    price: f.price,
    quote: f.quote,
    createdAt: new Date().toISOString(),
  };
  const leaf = leafHash(body);
  for (let attempt = 1; ; attempt++) {
    const [{ id }] = await q<{ id: string }>("select nextval(pg_get_serial_sequence('fills', 'id')) as id");
    try {
      await q(
        `with last as (select seq, hash from fills where account = $2 order by seq desc limit 1)
         insert into fills (id, account, handle, source_fill, created_at, seq, prev_hash, hash, sealed)
         select $1, $2, $3, $4, $5,
           coalesce((select seq from last), 0) + 1,
           coalesce((select hash from last), $6),
           encode(sha256(convert_to(coalesce((select hash from last), $6) || $7, 'UTF8')), 'hex'),
           $8`,
        [id, account, handle, sourceFill, body.createdAt, GENESIS, leaf, seal(body, fillAad(Number(id)))],
      );
      return Number(id);
    } catch (e) {
      if (attempt >= 4 || !/fills_account_seq|duplicate key/.test(String(e))) throw e;
    }
  }
}

export async function snapshot(account: string, startCash: number, prices: Record<string, number>): Promise<number> {
  const book = replay(startCash, await accountFills(account));
  const v = equity(book, prices);
  await q("insert into equity (account, value) values ($1, $2)", [account, v]);
  return v;
}

export type TradeOrder = { side: "buy"; symbol: string; usdc: number } | { side: "sell"; symbol: string; fraction: number };

export type TradeResult = { fillId: number; fill: PaperFill; queued: number };

/**
 * Executes a paper trade at a live, signature-verified 1Click dry quote, then queues one mirror job
 * per active blind-copy pass. Workers apply them in parallel, in order per follower.
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
  const queued = await enqueueMirrors({ handle: trader.handle, side: order.side, symbol: order.symbol, fraction, sourceFill: fillId, prices });
  return { fillId, fill, queued };
}

export type MirrorJob = {
  handle: string;
  holder: string;
  allocation: number;
  side: "buy" | "sell";
  symbol: string;
  fraction: number;
  sourceFill: number;
  prices: Record<string, number>;
};

/** Applies one queued mirror to one follower. Idempotent per (follower, source fill), so retries are safe. */
export async function mirrorOne(j: MirrorJob): Promise<"mirrored" | "skipped" | "duplicate"> {
  const account = copyAccount(j.holder, j.handle);
  const done = await q("select 1 from fills where account = $1 and source_fill = $2 union all select 1 from skipped_copies where account = $1 and source_fill = $2", [
    account,
    j.sourceFill,
  ]);
  if (done.length) return "duplicate";
  const asset = market(j.symbol);
  const book = replay(j.allocation, await accountFills(account));
  const eq = equity(book, j.prices);
  let f: PaperFill;
  try {
    if (j.side === "buy") {
      const usdc = Math.min(eq * j.fraction, book.cash);
      const guard = riskGuard(book.positions[j.symbol]?.qty ?? 0, j.prices[j.symbol] ?? 0, usdc, eq);
      if (guard) throw new SkipError(guard);
      f = await paperBuy(asset, usdc);
    } else {
      const qty = (book.positions[j.symbol]?.qty ?? 0) * j.fraction;
      if (qty * (j.prices[j.symbol] ?? 0) < 0.5) throw new SkipError("no mirrored position to sell");
      f = await paperSell(asset, qty);
    }
  } catch (e) {
    if (!(e instanceof SkipError)) throw e;
    await recordSkip(account, j.sourceFill, e.message);
    return "skipped";
  }
  await recordFill(account, j.handle, f, j.sourceFill);
  await snapshot(account, j.allocation, j.prices);
  return "mirrored";
}

export async function recordSkip(account: string, sourceFill: number, reason: string): Promise<void> {
  await q("insert into skipped_copies (account, source_fill, reason) values ($1,$2,$3)", [account, sourceFill, reason.slice(0, 200)]);
}

class SkipError extends Error {}

/** Follower-side guard: skip copies that are too small or would put over 60% of the account in one asset. */
export function riskGuard(heldQty: number, price: number, usdc: number, equityNow: number): string | null {
  if (usdc < MIN_TRADE_USDC) return `copy size $${usdc.toFixed(2)} is below the $${MIN_TRADE_USDC} minimum`;
  if (equityNow > 0 && (heldQty * price + usdc) / equityNow > 0.6) return "would exceed 60% of the account in one asset";
  return null;
}

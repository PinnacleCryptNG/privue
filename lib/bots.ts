import { dueNote, generateNote, notesEnabled } from "./notes";
import { q } from "./db";
import { accountFills, getTrader, snapshot, symbolPrices, trade, traderAccount, type TradeOrder, type Trader } from "./engine";
import { equity, replay } from "./stats";
import { log as jlog } from "./log";

export const SEED_TRADERS: Omit<Trader, "created_at">[] = [
  {
    handle: "atlas",
    name: "Atlas",
    owner: "privue-app.testnet",
    bio: "Trend follower. Buys strength, cuts losers fast.",
    style: "Momentum",
    markets: ["NEAR", "SOL"],
    start_cash: 10000,
    is_bot: true,
  },
  {
    handle: "kestrel",
    name: "Kestrel",
    owner: "privue-app.testnet",
    bio: "Fades sharp moves in the majors and waits for the snap-back.",
    style: "Mean reversion",
    markets: ["BTC", "ETH"],
    start_cash: 10000,
    is_bot: true,
  },
  {
    handle: "juno",
    name: "Juno",
    owner: "privue-app.testnet",
    bio: "Swing trades privacy coins and NEAR on multi-hour ranges.",
    style: "Range swing",
    markets: ["ZEC", "NEAR"],
    start_cash: 10000,
    is_bot: true,
  },
];

export async function ensureSeeded(): Promise<void> {
  for (const t of SEED_TRADERS) {
    await q(
      `insert into traders (handle, name, owner, bio, style, markets, start_cash, is_bot)
       values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (handle) do nothing`,
      [t.handle, t.name, t.owner, t.bio, t.style, t.markets, t.start_cash, t.is_bot],
    );
  }
}

async function recentPrices(symbol: string, n: number): Promise<number[]> {
  const rows = await q<{ price: number }>("select price from prices where symbol = $1 order by ts desc limit $2", [symbol, n]);
  return rows.map((r) => Number(r.price)).reverse();
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Pure decision rule per bot style; exported for tests. */
export function decide(style: string, price: number, history: number[], held: boolean, cashShare: number, hoursIdle: number): "buy" | "sell" | null {
  if (history.length < 4 || price <= 0) return null;
  const drift = price / avg(history) - 1;
  if (style === "Momentum") {
    if (!held && drift > 0.002 && cashShare > 0.2) return "buy";
    if (held && drift < -0.002) return "sell";
  } else if (style === "Mean reversion") {
    if (!held && drift < -0.003 && cashShare > 0.2) return "buy";
    if (held && drift > 0.003) return "sell";
  } else {
    if (!held && (drift < -0.0015 || hoursIdle > 6) && cashShare > 0.2) return "buy";
    if (held && (drift > 0.004 || hoursIdle > 10)) return "sell";
  }
  return null;
}

export type TickLog = { handle: string; symbol: string; action: string; detail?: string };

const MIN_TICK_GAP_MINUTES = 10;

/** Atomically claims the next tick slot so any caller (GitHub Actions, Vercel cron, a visitor) runs bots at most every 10 min. */
export async function claimTick(): Promise<boolean> {
  const rows = await q<{ id: number }>(
    `insert into ticks (ts) select now() where pg_try_advisory_xact_lock(4242)
       and not exists (select 1 from ticks where ts > now() - make_interval(mins => $1)) returning id`,
    [MIN_TICK_GAP_MINUTES],
  );
  return rows.length > 0;
}

/** Latest stored prices from the price worker, falling back to (and recording) a live fetch when stale. */
async function freshPrices(maxAgeMin = 10): Promise<Record<string, number>> {
  const rows = await q<{ symbol: string; price: number }>(
    `select distinct on (symbol) symbol, price from prices where ts > now() - make_interval(mins => $1) order by symbol, ts desc`,
    [maxAgeMin],
  );
  const stored = Object.fromEntries(rows.map((r) => [r.symbol, Number(r.price)]));
  if (SEED_TRADERS.every((t) => t.markets.every((m) => stored[m] > 0))) return { ...(await symbolPrices().catch(() => ({}))), ...stored };
  const live = await symbolPrices();
  for (const [symbol, price] of Object.entries(live)) {
    if (price > 0) await q("insert into prices (symbol, price) values ($1, $2)", [symbol, price]);
  }
  return live;
}

export async function tick(): Promise<TickLog[]> {
  await ensureSeeded();
  const prices = await freshPrices();
  const log: TickLog[] = [];
  for (const seed of SEED_TRADERS) {
    const trader = (await getTrader(seed.handle))!;
    const account = traderAccount(trader.handle);
    const fills = await accountFills(account);
    const book = replay(trader.start_cash, fills);
    const eq = equity(book, prices);
    const last = fills.at(-1);
    const hoursIdle = last ? (Date.now() - Date.parse(last.createdAt)) / 3.6e6 : 99;
    let acted = false;
    for (const symbol of trader.markets) {
      if (acted) break;
      const held = (book.positions[symbol]?.qty ?? 0) * (prices[symbol] ?? 0) > 1;
      const history = (await recentPrices(symbol, 8)).slice(0, -1);
      const action = decide(trader.style, prices[symbol] ?? 0, history, held, book.cash / eq, hoursIdle);
      if (!action) continue;
      const order: TradeOrder =
        action === "buy"
          ? { side: "buy", symbol, usdc: Math.round(eq * (0.15 + Math.random() * 0.15)) }
          : { side: "sell", symbol, fraction: 1 };
      try {
        const r = await trade(trader, order);
        log.push({ handle: trader.handle, symbol, action, detail: `fill ${r.fillId}, ${r.queued} copies queued` });
        acted = true;
      } catch (e) {
        log.push({ handle: trader.handle, symbol, action: "error", detail: e instanceof Error ? e.message : String(e) });
      }
    }
    if (!acted) await snapshot(account, trader.start_cash, prices);
  }
  await snapshotCopies(prices);
  if (notesEnabled()) {
    const handle = await dueNote(SEED_TRADERS.map((t) => t.handle));
    if (handle) {
      try {
        const n = await generateNote(handle);
        log.push({ handle, symbol: "-", action: "note", detail: `note ${n.id}, signature ${n.proof.signature.status}` });
      } catch (e) {
        log.push({ handle, symbol: "-", action: "note_error", detail: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  jlog("info", "tick.done", { actions: log.map((l) => `${l.handle}:${l.action}`) });
  return log;
}

async function snapshotCopies(prices: Record<string, number>): Promise<void> {
  const subs = await q<{ holder: string; handle: string; allocation: number }>(
    "select holder, handle, allocation from passes where tier = 'copy'",
  );
  for (const s of subs) await snapshot(`copy:${s.holder}:${s.handle}`, Number(s.allocation), prices);
}

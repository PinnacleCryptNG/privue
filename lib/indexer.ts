import { q } from "./db";
import { commitLog, passLog, type PassEvent } from "./near";

async function cursor(name: string): Promise<number> {
  const [r] = await q<{ value: string }>("select value from cursors where name = $1", [name]);
  return r ? Number(r.value) : 0;
}

const setCursor = (name: string, value: number) =>
  q("insert into cursors (name, value) values ($1, $2) on conflict (name) do update set value = excluded.value, updated_at = now()", [name, value]);

async function apply(e: PassEvent): Promise<void> {
  const inserted = await q(
    `insert into pass_events (seq, kind, handle, tier, holder, from_holder, expires_at, at)
     values ($1,$2,$3,$4,$5,$6,to_timestamp($7 / 1000.0),to_timestamp($8 / 1000.0)) on conflict (seq) do nothing returning seq`,
    [e.seq, e.kind, e.handle, e.tier, e.holder, e.from, e.expires_at_ms, e.at_ms],
  );
  if (!inserted.length) return;
  let allocation = 1000;
  if (e.kind === "transferred" && e.from) {
    const [old] = await q<{ allocation: number }>("delete from passes where holder = $1 and handle = $2 and tier = $3 returning allocation", [e.from, e.handle, e.tier]);
    if (old) allocation = Number(old.allocation);
  }
  await q(
    `insert into passes (holder, handle, tier, expires_at, allocation) values ($1,$2,$3,to_timestamp($4 / 1000.0),$5)
     on conflict (holder, handle, tier) do update set expires_at = excluded.expires_at`,
    [e.holder, e.handle, e.tier, e.expires_at_ms, allocation],
  );
}

/**
 * Follows the contract's append-only pass and commitment logs by sequence number, so passes bought,
 * renewed or moved outside the app (any wallet, any frontend) show up in Privue. The chain stays the
 * source of truth: the database is a cache that can be rebuilt by resetting the cursors.
 */
export async function index(maxBatches = 10): Promise<{ passEvents: number; commits: number }> {
  let passEvents = 0;
  let commits = 0;
  for (let i = 0; i < maxBatches; i++) {
    const from = await cursor("pass_log");
    const events = await passLog(from);
    for (const e of events) await apply(e);
    if (events.length) await setCursor("pass_log", from + events.length);
    passEvents += events.length;
    if (events.length < 100) break;
  }
  for (let i = 0; i < maxBatches; i++) {
    const from = await cursor("commit_log");
    const cs = await commitLog(from);
    for (const c of cs) {
      await q("insert into commitments (handle, count, head, at) values ($1,$2,$3,to_timestamp($4 / 1000.0)) on conflict do nothing", [
        c.handle,
        c.count,
        c.head,
        c.at_ms,
      ]);
    }
    if (cs.length) await setCursor("commit_log", from + cs.length);
    commits += cs.length;
    if (cs.length < 100) break;
  }
  return { passEvents, commits };
}

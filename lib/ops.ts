import { q } from "./db";
import { log } from "./log";

/** Atomically claims a named slot at most once per `minGapSec`, whoever calls (GitHub Actions, Vercel cron, a visitor). */
export async function claimSlot(name: string, minGapSec: number): Promise<boolean> {
  const rows = await q(
    `insert into cursors (name, value) values ($1, 0)
     on conflict (name) do update set updated_at = now()
       where cursors.updated_at < now() - make_interval(secs => $2)
     returning name`,
    [`slot:${name}`, minGapSec],
  );
  return rows.length > 0;
}

/** Runs a worker, records how it went in `runs` (for /api/health), and logs the outcome. */
export async function recordRun<T>(worker: string, fn: () => Promise<T>, summarize: (r: T) => unknown = (r) => r): Promise<T> {
  const t0 = Date.now();
  try {
    const r = await fn();
    const detail = summarize(r);
    await q("insert into runs (worker, ok, ms, detail) values ($1, true, $2, $3)", [worker, Date.now() - t0, JSON.stringify(detail ?? null)]);
    log("info", `worker.${worker}`, { ms: Date.now() - t0, detail });
    return r;
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 300) : String(e);
    await q("insert into runs (worker, ok, ms, detail) values ($1, false, $2, $3)", [worker, Date.now() - t0, JSON.stringify({ error })]).catch(() => {});
    log("error", `worker.${worker}`, { ms: Date.now() - t0, error });
    throw e;
  }
}

export async function lastRuns(): Promise<Record<string, { ok: boolean; ageSec: number; ms: number }>> {
  const rows = await q<{ worker: string; ok: boolean; ms: number; age: number }>(
    `select distinct on (worker) worker, ok, ms, extract(epoch from now() - created_at)::int as age
     from runs where created_at > now() - interval '7 days' order by worker, id desc`,
  );
  return Object.fromEntries(rows.map((r) => [r.worker, { ok: r.ok, ageSec: Number(r.age), ms: Number(r.ms) }]));
}

export async function pruneOps(): Promise<void> {
  await q("delete from runs where created_at < now() - interval '14 days'");
  await q("delete from rate_limits where window_start < now() - interval '2 days'");
  await q("delete from jobs where status = 'done' and finished_at < now() - interval '7 days'");
}

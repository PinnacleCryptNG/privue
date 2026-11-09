import { q } from "./db";
import { log } from "./log";

export type Job = { id: number; kind: string; lane: string; payload: unknown; attempts: number };

const MAX_ATTEMPTS = 5;
const LEASE_SECONDS = 90;

/** One job per active copy pass. The lane is the follower's copy account, so each follower's mirrors apply in order. */
export async function enqueueMirrors(src: {
  handle: string;
  side: "buy" | "sell";
  symbol: string;
  fraction: number;
  sourceFill: number;
  prices: Record<string, number>;
}): Promise<number> {
  const rows = await q<{ id: number }>(
    `insert into jobs (kind, lane, payload)
     select 'mirror', 'copy:' || holder || ':' || handle,
       jsonb_build_object('handle', handle, 'holder', holder, 'allocation', allocation) || $2::jsonb
     from passes where handle = $1 and tier = 'copy' and expires_at > now()
     returning id`,
    [src.handle, JSON.stringify({ side: src.side, symbol: src.symbol, fraction: src.fraction, sourceFill: src.sourceFill, prices: src.prices })],
  );
  return rows.length;
}

/** Leases up to n ready jobs. A job is ready only when no earlier job in its lane is still pending. */
export async function claim(n: number): Promise<Job[]> {
  const rows = await q<Job>(
    `update jobs set status = 'running', attempts = attempts + 1, locked_until = now() + make_interval(secs => $2)
     where id in (
       select j.id from jobs j
       where ((j.status = 'queued' and j.run_after <= now()) or (j.status = 'running' and j.locked_until < now()))
         and not exists (select 1 from jobs e where e.lane = j.lane and e.id < j.id and e.status in ('queued', 'running'))
       order by j.id limit $1
       for update skip locked)
     returning id, kind, lane, payload, attempts`,
    [n, LEASE_SECONDS],
  );
  return rows.map((r) => ({ ...r, id: Number(r.id), attempts: Number(r.attempts) }));
}

async function finish(job: Job, error: unknown): Promise<void> {
  if (!error) {
    await q("update jobs set status = 'done', finished_at = now(), locked_until = null where id = $1", [job.id]);
    return;
  }
  const msg = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  const dead = job.attempts >= MAX_ATTEMPTS;
  await q(
    `update jobs set status = $2, last_error = $3, locked_until = null,
       run_after = now() + make_interval(secs => $4), finished_at = case when $2 = 'failed' then now() end
     where id = $1`,
    [job.id, dead ? "failed" : "queued", msg, 10 * 2 ** job.attempts],
  );
  log(dead ? "error" : "warn", "job.failed", { job: job.id, kind: job.kind, attempts: job.attempts, dead, error: msg });
}

export type Handlers = Record<string, (payload: never, job: Job) => Promise<unknown>>;

/** Drains the queue with bounded parallelism until it is empty or the time budget runs out. */
export async function drain(handlers: Handlers, opts: { concurrency?: number; budgetMs?: number } = {}): Promise<{ done: number; failed: number }> {
  const deadline = Date.now() + (opts.budgetMs ?? 50_000);
  const concurrency = opts.concurrency ?? 8;
  let done = 0;
  let failed = 0;
  while (Date.now() < deadline) {
    const batch = await claim(concurrency);
    if (!batch.length) break;
    await Promise.all(
      batch.map(async (job) => {
        const handler = handlers[job.kind];
        try {
          if (!handler) throw new Error(`no handler for ${job.kind}`);
          await handler(job.payload as never, job);
          await finish(job, null);
          done++;
        } catch (e) {
          await finish(job, e);
          failed++;
        }
      }),
    );
  }
  return { done, failed };
}

export async function queueStats(): Promise<{ queued: number; running: number; failed24h: number; oldestQueuedSec: number | null }> {
  const [r] = await q<{ queued: number; running: number; failed24h: number; oldest: number | null }>(
    `select count(*) filter (where status = 'queued')::int as queued,
            count(*) filter (where status = 'running')::int as running,
            count(*) filter (where status = 'failed' and finished_at > now() - interval '1 day')::int as "failed24h",
            extract(epoch from now() - min(created_at) filter (where status = 'queued'))::int as oldest
     from jobs where status <> 'done' or finished_at > now() - interval '1 day'`,
  );
  return { queued: r.queued, running: r.running, failed24h: r.failed24h, oldestQueuedSec: r.oldest == null ? null : Number(r.oldest) };
}

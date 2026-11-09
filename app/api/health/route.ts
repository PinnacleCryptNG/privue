import { json } from "@/lib/access";
import { MIGRATIONS, q } from "@/lib/db";
import { queueStats } from "@/lib/jobs";
import { contractInfo, CONTRACT_ID } from "@/lib/near";
import { notesEnabled } from "@/lib/notes";
import { lastRuns } from "@/lib/ops";

export const dynamic = "force-dynamic";

// GitHub throttles scheduled workflows to roughly every 1-4 hours, so allow for that cadence.
const STALE_SEC: Record<string, number> = { prices: 6 * 3600, index: 6 * 3600, tick: 6 * 3600 };

async function check<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "error" };
  }
}

/** Liveness and freshness for uptime checks. Never returns private data or secrets. */
export async function GET() {
  const [db, chain, runs, queue] = await Promise.all([
    check(async () => {
      const [r] = await q<{ v: number }>("select max(version)::int as v from schema_migrations");
      return { schema: r.v, expected: MIGRATIONS.at(-1)!.version };
    }),
    check(contractInfo),
    check(lastRuns),
    check(queueStats),
  ]);
  const [tick] = db.ok ? await q<{ age: number }>("select extract(epoch from now() - max(ts))::int as age from ticks") : [];
  const workers = runs.ok ? { ...runs.value, tick: { ok: true, ageSec: Number(tick?.age ?? 1e9), ms: 0 } } : {};
  const stale = Object.entries(STALE_SEC).filter(([w, max]) => !(w in workers) || (workers as Record<string, { ageSec: number }>)[w].ageSec > max).map(([w]) => w);
  const problems = [
    ...(db.ok ? (db.value.schema === db.value.expected ? [] : ["schema behind"]) : ["database"]),
    ...(chain.ok ? (chain.value.paused ? ["contract paused"] : []) : ["near rpc"]),
    ...(queue.ok && queue.value.failed24h > 0 ? [`${queue.value.failed24h} failed jobs in 24h`] : []),
    ...(queue.ok && (queue.value.oldestQueuedSec ?? 0) > 900 ? ["queue backlog"] : []),
    ...stale.map((w) => `${w} stale`),
  ];
  const ok = db.ok && chain.ok && problems.length === 0;
  return json(
    {
      ok,
      problems,
      network: "testnet",
      contract: CONTRACT_ID,
      db,
      chain: chain.ok ? { ok: true, paused: chain.value.paused, operator: chain.value.operator, passesLogged: chain.value.passes_logged, commitsLogged: chain.value.commits_logged } : chain,
      queue,
      workers,
      config: { notes: notesEnabled(), fillKey: Boolean(process.env.FILL_KEY), sponsor: Boolean(process.env.NEAR_SPONSOR_KEY) },
    },
    ok ? 200 : 503,
  );
}

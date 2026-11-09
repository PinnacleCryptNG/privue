import { fail, json } from "@/lib/access";
import { q } from "@/lib/db";
import { symbolPrices } from "@/lib/engine";
import { index } from "@/lib/indexer";
import { claimSlot, pruneOps, recordRun } from "@/lib/ops";
import { anchorAll } from "@/lib/record";
import { work } from "@/lib/worker";

export const maxDuration = 300;

/** Price feed, separate from bot decisions, so prices stay fresh even when no bot trades. */
async function prices() {
  const px = await symbolPrices();
  const live = Object.entries(px).filter(([, p]) => p > 0);
  for (const [symbol, price] of live) await q("insert into prices (symbol, price) values ($1, $2)", [symbol, price]);
  return { symbols: live.length };
}

/** Each worker claims a DB slot, so any caller (GitHub Actions, Vercel cron, a visitor) can't run it more often than this. */
const JOBS: Record<string, { gapSec: number; run: () => Promise<unknown> }> = {
  prices: { gapSec: 240, run: () => recordRun("prices", prices) },
  index: { gapSec: 60, run: () => recordRun("index", async () => ({ ...(await index()), pruned: await pruneOps().then(() => true) })) },
  anchor: { gapSec: 600, run: () => recordRun("anchor", anchorAll) },
  work: { gapSec: 0, run: () => work(250_000) },
};

async function handle(_req: Request, ctx: RouteContext<"/api/cron/[job]">) {
  const { job } = await ctx.params;
  const j = JOBS[job];
  if (!j) return fail("unknown job", 404);
  if (j.gapSec && !(await claimSlot(job, j.gapSec))) return json({ skipped: `${job} ran less than ${j.gapSec}s ago` });
  try {
    return json({ job, result: await j.run() });
  } catch (e) {
    return fail(`${job} failed: ${e instanceof Error ? e.message.slice(0, 200) : "error"}`, 500);
  }
}

export const GET = handle;
export const POST = handle;

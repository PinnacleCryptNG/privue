import { json } from "@/lib/access";
import { claimTick, tick } from "@/lib/bots";
import { recordRun } from "@/lib/ops";
import { kick } from "@/lib/worker";

export const maxDuration = 300;

/** Public on purpose: the DB slot claim limits bot runs to one per 10 minutes no matter who calls. */
async function handle() {
  if (!(await claimTick())) return json({ skipped: "a tick ran in the last 10 minutes" });
  const log = await recordRun("tick", tick, (l) => ({ actions: l.length }));
  kick();
  return json({ log });
}

export const GET = handle;
export const POST = handle;

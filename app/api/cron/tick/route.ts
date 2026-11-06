import { json } from "@/lib/access";
import { claimTick, tick } from "@/lib/bots";

export const maxDuration = 300;

/** Public on purpose: the DB slot claim limits bot runs to one per 10 minutes no matter who calls. */
async function handle() {
  if (!(await claimTick())) return json({ skipped: "a tick ran in the last 10 minutes" });
  return json({ log: await tick() });
}

export const GET = handle;
export const POST = handle;

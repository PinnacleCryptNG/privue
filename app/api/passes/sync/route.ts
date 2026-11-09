import { z } from "zod";
import { fail, json } from "@/lib/access";
import { syncPass } from "@/lib/passes";
import { limit } from "@/lib/ratelimit";
import { getSession } from "@/lib/session";

const Body = z.object({ handle: z.string(), tier: z.enum(["view", "delayed", "copy"]), tx: z.string().max(64).nullish() });

/** After a wallet purchase, read the pass back from the contract; the chain is the source of truth. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail("sign in first", 401);
  const limited = await limit([{ name: "sync", max: 60, windowSec: 3600, by: session.sub }]);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid request");
  const pass = await syncPass(session.sub, parsed.data.handle, parsed.data.tier, parsed.data.tx ?? null);
  if (!pass) return fail("no active pass on-chain for this account yet", 404);
  return json({ pass });
}

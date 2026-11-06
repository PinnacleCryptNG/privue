import { z } from "zod";
import { fail, json } from "@/lib/access";
import { q } from "@/lib/db";
import { getTrader } from "@/lib/engine";
import { EXPLORER, sponsoredBuy } from "@/lib/near";
import { storePass } from "@/lib/passes";
import { getSession } from "@/lib/session";

export const maxDuration = 60;

const Body = z.object({ handle: z.string(), tier: z.enum(["view", "copy"]) });
const DAILY_CAP = Number(process.env.SPONSOR_DAILY_CAP ?? 60);

/** Demo path for visitors without a testnet wallet: Privue's testnet account buys the pass on-chain for them. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail("sign in first", 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid request");
  const { handle, tier } = parsed.data;
  const trader = await getTrader(handle);
  if (!trader) return fail("no such trader", 404);
  if (trader.owner === session.sub) return fail("you can't buy your own pass");
  const [{ n }] = await q<{ n: number }>("select count(*)::int as n from passes where tx is not null and created_at > now() - interval '1 day'");
  if (n >= DAILY_CAP) return fail("today's free demo passes are used up; buy with a testnet wallet instead", 429);
  const have = await q("select 1 from passes where holder = $1 and handle = $2 and tier = $3 and expires_at > now()", [session.sub, handle, tier]);
  if (have.length) return fail("you already hold this pass");
  try {
    const { tx, pass } = await sponsoredBuy(handle, tier, session.sub);
    await storePass(pass, tx);
    return json({ tx, explorer: `${EXPLORER}/txns/${tx}`, pass });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "purchase failed", 502);
  }
}

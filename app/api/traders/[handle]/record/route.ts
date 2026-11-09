import { accessFor, fail, json } from "@/lib/access";
import { accountFills, getTrader, traderAccount } from "@/lib/engine";
import { limit } from "@/lib/ratelimit";
import { checkRecord } from "@/lib/record";
import { getSession } from "@/lib/session";

/** Public: checks the trader's stored record against the checkpoints anchored on NEAR testnet. */
export async function GET(_req: Request, ctx: RouteContext<"/api/traders/[handle]/record">) {
  const { handle } = await ctx.params;
  const limited = await limit([{ name: "record", max: 60, windowSec: 60, by: "ip" }]);
  if (limited) return limited;
  const trader = await getTrader(handle);
  if (!trader) return fail("no such trader", 404);
  const access = await accessFor(await getSession(), trader);
  const fills = access.view ? await accountFills(traderAccount(handle)) : undefined;
  return json(await checkRecord(handle, fills));
}

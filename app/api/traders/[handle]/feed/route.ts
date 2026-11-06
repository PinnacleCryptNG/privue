import { accessFor, fail, json } from "@/lib/access";
import { accountFills, getTrader, traderAccount } from "@/lib/engine";
import { getSession } from "@/lib/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/traders/[handle]/feed">) {
  const { handle } = await ctx.params;
  const trader = await getTrader(handle);
  if (!trader) return fail("no such trader", 404);
  const access = await accessFor(await getSession(), trader);
  if (!access.view) return fail(access.copy ? "copy passes are blind: trades are mirrored, never shown" : "a view pass is required", 403);
  const fills = await accountFills(traderAccount(handle));
  return json({ fills: fills.reverse().slice(0, 200) });
}

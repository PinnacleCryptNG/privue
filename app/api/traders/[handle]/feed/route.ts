import { accessFor, DELAY_HOURS, fail, json } from "@/lib/access";
import { accountFills, getTrader, traderAccount } from "@/lib/engine";
import { getSession } from "@/lib/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/traders/[handle]/feed">) {
  const { handle } = await ctx.params;
  const trader = await getTrader(handle);
  if (!trader) return fail("no such trader", 404);
  const access = await accessFor(await getSession(), trader);
  if (!access.view && !access.delayed) return fail(access.copy ? "copy passes are blind: trades are mirrored, never shown" : "a view pass is required", 403);
  const all = await accountFills(traderAccount(handle));
  const cutoff = Date.now() - DELAY_HOURS * 3.6e6;
  const fills = access.view ? all : all.filter((f) => Date.parse(f.createdAt) <= cutoff);
  return json({
    delayedHours: access.view ? 0 : DELAY_HOURS,
    hidden: all.length - fills.length,
    fills: fills.reverse().slice(0, 200).map(({ hash, ...f }) => ({ ...f, chainHash: hash })),
  });
}

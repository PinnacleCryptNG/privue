import { accessFor, fail, json } from "@/lib/access";
import { q } from "@/lib/db";
import { getTrader } from "@/lib/engine";
import { publicContext, publicCurve, publicTrader } from "@/lib/public";
import { getSession } from "@/lib/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/traders/[handle]">) {
  const { handle } = await ctx.params;
  const trader = await getTrader(handle);
  if (!trader) return fail("no such trader", 404);
  const [session, pc] = await Promise.all([getSession(), publicContext()]);
  const [pub, curve, access, note, proofs] = await Promise.all([
    publicTrader(trader, pc.prices, pc.offers),
    publicCurve(handle),
    accessFor(session, trader),
    q<{ body: string; model: string; proof: unknown; created_at: string }>(
      "select body, model, proof, created_at from notes where handle = $1 order by id desc limit 1",
      [handle],
    ),
    q<{ n: number; latest: number | null }>("select count(*)::int as n, max(id)::int as latest from fills where account = $1", [`trader:${handle}`]),
  ]);
  return json({ trader: pub, curve, access, note: note[0] ?? null, signedFills: proofs[0]?.n ?? 0, latestFill: proofs[0]?.latest ?? null });
}

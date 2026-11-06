import { z } from "zod";
import { fail, json } from "@/lib/access";
import { getTrader, trade } from "@/lib/engine";
import { getSession } from "@/lib/session";

export const maxDuration = 120;

const Body = z.discriminatedUnion("side", [
  z.object({ handle: z.string(), side: z.literal("buy"), symbol: z.string(), usdc: z.number().min(5).max(1_000_000) }),
  z.object({ handle: z.string(), side: z.literal("sell"), symbol: z.string(), fraction: z.number().gt(0).max(1) }),
]);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail("sign in first", 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid order");
  const trader = await getTrader(parsed.data.handle);
  if (!trader || trader.owner !== session.sub) return fail("only the trader can place trades", 403);
  try {
    const d = parsed.data;
    const r = await trade(trader, d.side === "buy" ? { side: "buy", symbol: d.symbol, usdc: d.usdc } : { side: "sell", symbol: d.symbol, fraction: d.fraction });
    return json({ fillId: r.fillId, side: r.fill.side, symbol: r.fill.asset.symbol, qty: r.fill.qty, usdc: r.fill.usdc, price: r.fill.price, mirrored: r.mirrored, skipped: r.skipped });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "trade failed", 422);
  }
}

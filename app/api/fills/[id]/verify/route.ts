import { createHash } from "node:crypto";
import { fail, json } from "@/lib/access";
import { getFill } from "@/lib/engine";
import { verifyQuote, type SignedQuote } from "@/lib/oneclick";

/** Public proof for any fill: re-checks the 1Click quote signature without revealing the trade. */
export async function GET(_req: Request, ctx: RouteContext<"/api/fills/[id]/verify">) {
  const { id } = await ctx.params;
  if (!/^\d{1,15}$/.test(id)) return fail("bad id");
  const f = await getFill(Number(id));
  if (!f) return fail("no such fill", 404);
  return json({
    fill: f.id,
    trader: f.handle,
    kind: f.account.startsWith("copy:") ? "copy" : "trader",
    seq: f.seq,
    chainHash: f.hash,
    recordedAt: f.createdAt,
    quoteTimestamp: f.quote.timestamp,
    quoteHash: createHash("sha256").update(JSON.stringify(f.quote)).digest("hex"),
    signature: f.quote.signature,
    signatureValid: verifyQuote(f.quote as unknown as SignedQuote),
  });
}

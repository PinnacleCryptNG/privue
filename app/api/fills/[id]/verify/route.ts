import { createHash } from "node:crypto";
import { fail, json } from "@/lib/access";
import { q } from "@/lib/db";
import { verifyQuote } from "@/lib/oneclick";

/** Public proof for any fill: re-checks the 1Click quote signature without revealing the trade. */
export async function GET(_req: Request, ctx: RouteContext<"/api/fills/[id]/verify">) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return fail("bad id");
  const rows = await q<{ quote: { signature: string; timestamp: string }; handle: string; account: string; created_at: string }>(
    "select quote, handle, account, created_at from fills where id = $1",
    [id],
  );
  const row = rows[0];
  if (!row) return fail("no such fill", 404);
  return json({
    fill: Number(id),
    trader: row.handle,
    kind: row.account.startsWith("copy:") ? "copy" : "trader",
    recordedAt: new Date(row.created_at).toISOString(),
    quoteTimestamp: row.quote.timestamp,
    quoteHash: createHash("sha256").update(JSON.stringify(row.quote)).digest("hex"),
    signature: row.quote.signature,
    signatureValid: verifyQuote(row.quote),
  });
}

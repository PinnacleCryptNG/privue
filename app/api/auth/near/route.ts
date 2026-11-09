import { cookies } from "next/headers";
import { z } from "zod";
import { fail, json } from "@/lib/access";
import { AUTH_MESSAGE, verifyNep413 } from "@/lib/near";
import { log } from "@/lib/log";
import { mergeGuest, type MergeResult } from "@/lib/merge";
import { limit } from "@/lib/ratelimit";
import { createSession, getSession } from "@/lib/session";

const Body = z.object({
  accountId: z.string().min(2).max(64),
  publicKey: z.string().startsWith("ed25519:"),
  signature: z.string().min(10),
  recipient: z.string().min(1).max(200),
  callbackUrl: z.string().max(500).nullish(),
});

export const maxDuration = 60;

export async function POST(req: Request) {
  const limited = await limit([{ name: "near-signin", max: 20, windowSec: 600, by: "ip" }]);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("bad sign-in payload");
  const jar = await cookies();
  const nonce = jar.get("privue_nonce")?.value;
  if (!nonce) return fail("sign-in challenge expired, try again", 401);
  const b = parsed.data;
  const ok = await verifyNep413({ ...b, message: AUTH_MESSAGE, nonce: Buffer.from(nonce, "base64") });
  if (!ok) return fail("signature did not verify for this account", 401);
  jar.delete("privue_nonce");
  const session = { sub: b.accountId.toLowerCase(), kind: "near" as const };
  const previous = await getSession();
  let merged: MergeResult | null = null;
  if (previous?.kind === "guest") {
    merged = await mergeGuest(previous.sub, session.sub).catch((e) => {
      log("error", "merge.failed", { error: e instanceof Error ? e.message : String(e) });
      return null;
    });
  }
  await createSession(session);
  return json({ session, merged });
}

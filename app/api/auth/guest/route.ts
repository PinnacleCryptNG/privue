import { randomBytes } from "node:crypto";
import { json } from "@/lib/access";
import { createSession, getSession } from "@/lib/session";

export async function POST() {
  const existing = await getSession();
  if (existing) return json({ session: existing });
  const session = { sub: `guest-${randomBytes(5).toString("hex")}`, kind: "guest" as const };
  await createSession(session);
  return json({ session });
}

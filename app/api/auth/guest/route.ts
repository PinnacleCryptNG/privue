import { randomBytes } from "node:crypto";
import { json } from "@/lib/access";
import { limit } from "@/lib/ratelimit";
import { createSession, getSession } from "@/lib/session";

export async function POST() {
  const existing = await getSession();
  if (existing) return json({ session: { sub: existing.sub, kind: existing.kind } });
  const limited = await limit([
    { name: "guest", max: 10, windowSec: 3600, by: "ip" },
    { name: "guest-all", max: 500, windowSec: 3600, by: "global" },
  ]);
  if (limited) return limited;
  const session = { sub: `guest-${randomBytes(5).toString("hex")}`, kind: "guest" as const };
  await createSession(session);
  return json({ session });
}

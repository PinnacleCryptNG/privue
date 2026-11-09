import { fail, json } from "@/lib/access";
import { getSession, listSessions, revokeAll } from "@/lib/session";

export async function GET() {
  const s = await getSession();
  if (!s) return fail("sign in first", 401);
  const rows = await listSessions(s.sub);
  return json({ sessions: rows.map((r) => ({ current: r.jti === s.jti, kind: r.kind, createdAt: r.created_at, lastSeen: r.last_seen })) });
}

/** Signs this account out on every other device. */
export async function DELETE() {
  const s = await getSession();
  if (!s) return fail("sign in first", 401);
  return json({ revoked: await revokeAll(s.sub, s.jti) });
}

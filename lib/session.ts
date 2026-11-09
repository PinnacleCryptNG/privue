import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { q } from "./db";

export type Session = { sub: string; kind: "near" | "guest"; jti?: string };

const COOKIE = "privue_session";

function key(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(s);
}

/** Every session has a row in `sessions`, so it can be revoked server-side before its JWT expires. */
export async function createSession(s: Session): Promise<void> {
  const jti = randomBytes(16).toString("hex");
  await q("insert into sessions (jti, sub, kind) values ($1, $2, $3)", [jti, s.sub, s.kind]);
  const token = await new SignJWT({ kind: s.kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (!payload.sub) return null;
    const kind = payload.kind === "near" ? "near" : "guest";
    // Tokens issued before revocation existed carry no jti; they get one derived from the token and a row on first use.
    const jti = payload.jti ?? createHash("sha256").update(token).digest("hex").slice(0, 32);
    const [row] = await q<{ revoked: boolean }>(
      `insert into sessions (jti, sub, kind) values ($1, $2, $3)
       on conflict (jti) do update set last_seen = case when sessions.last_seen < now() - interval '1 hour' then now() else sessions.last_seen end
       returning revoked_at is not null as revoked`,
      [jti, payload.sub, kind],
    );
    if (row?.revoked) return null;
    return { sub: payload.sub, kind, jti };
  } catch {
    return null;
  }
}

export async function revokeSession(jti: string): Promise<void> {
  await q("update sessions set revoked_at = now() where jti = $1 and revoked_at is null", [jti]);
}

/** Signs an account out everywhere, optionally keeping the current session. */
export async function revokeAll(sub: string, keep?: string): Promise<number> {
  const rows = await q("update sessions set revoked_at = now() where sub = $1 and revoked_at is null and jti <> coalesce($2, '') returning jti", [sub, keep ?? null]);
  return rows.length;
}

export async function listSessions(sub: string): Promise<{ jti: string; kind: string; created_at: string; last_seen: string }[]> {
  return q("select jti, kind, created_at, last_seen from sessions where sub = $1 and revoked_at is null order by last_seen desc limit 20", [sub]);
}

export async function clearSession(): Promise<void> {
  const s = await getSession();
  if (s?.jti) await revokeSession(s.jti);
  (await cookies()).delete(COOKIE);
}

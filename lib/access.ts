import { q } from "./db";
import type { Trader } from "./engine";
import type { Session } from "./session";
import type { Tier } from "./near";

export async function activePass(holder: string, handle: string, tier: Tier): Promise<{ expires_at: string; allocation: number } | null> {
  const rows = await q<{ expires_at: string; allocation: number }>(
    "select expires_at, allocation from passes where holder = $1 and handle = $2 and tier = $3 and expires_at > now()",
    [holder.toLowerCase(), handle, tier],
  );
  return rows[0] ?? null;
}

export type Access = { owner: boolean; view: boolean; delayed: boolean; copy: boolean };

/** Delayed View holders see the same feed, but only fills older than this. */
export const DELAY_HOURS = 24;

export async function accessFor(session: Session | null, trader: Trader): Promise<Access> {
  if (!session) return { owner: false, view: false, delayed: false, copy: false };
  const owner = session.sub === trader.owner;
  const [view, delayed, copy] = await Promise.all([
    activePass(session.sub, trader.handle, "view"),
    activePass(session.sub, trader.handle, "delayed"),
    activePass(session.sub, trader.handle, "copy"),
  ]);
  return { owner, view: owner || !!view, delayed: !!delayed, copy: !!copy };
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

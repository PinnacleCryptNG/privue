import { json } from "@/lib/access";
import { q } from "@/lib/db";
import { accountStats, copyAccount, symbolPrices } from "@/lib/engine";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return json({ session: null });
  const [passes, traders, prices] = await Promise.all([
    q<{ handle: string; tier: string; expires_at: string; allocation: number; tx: string | null }>(
      "select handle, tier, expires_at, allocation, tx from passes where holder = $1 order by created_at desc",
      [session.sub],
    ),
    q<{ handle: string }>("select handle from traders where owner = $1", [session.sub]),
    symbolPrices(),
  ]);
  const copies = await Promise.all(
    passes
      .filter((p) => p.tier === "copy")
      .map(async (p) => ({ handle: p.handle, stats: await accountStats(copyAccount(session.sub, p.handle), Number(p.allocation), prices) })),
  );
  return json({ session, passes, traders: traders.map((t) => t.handle), copies });
}

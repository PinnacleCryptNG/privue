import { q } from "./db";
import { getPass, type OnchainPass, type Tier } from "./near";

export async function storePass(p: OnchainPass, tx: string | null, allocation = 1000): Promise<void> {
  await q(
    `insert into passes (holder, handle, tier, expires_at, allocation, tx) values ($1,$2,$3,$4,$5,$6)
     on conflict (holder, handle, tier) do update set expires_at = excluded.expires_at, tx = coalesce(excluded.tx, passes.tx)`,
    [p.holder.toLowerCase(), p.handle, p.tier, new Date(p.expires_at_ms).toISOString(), allocation, tx],
  );
}

export async function syncPass(holder: string, handle: string, tier: Tier, tx: string | null): Promise<OnchainPass | null> {
  const p = await getPass(handle, tier, holder);
  if (!p || p.expires_at_ms <= Date.now()) return null;
  await storePass(p, tx);
  return p;
}

import { q } from "./db";
import { copyAccount } from "./engine";
import { log } from "./log";
import { sponsoredSetOffer, sponsoredTransfer, getOffer, TIERS, type Tier } from "./near";
import { storePass } from "./passes";
import { revokeAll } from "./session";

export type MergeResult = { passes: number; skipped: number; trader: string | null };

/**
 * When a guest signs in with a NEAR wallet, their sponsored passes move on-chain to the wallet
 * (the operator bought them, so the contract lets it transfer), their copy history follows, and any
 * trader profile they made becomes wallet-owned, including the on-chain offers' payout account.
 */
export async function mergeGuest(guest: string, wallet: string): Promise<MergeResult> {
  const out: MergeResult = { passes: 0, skipped: 0, trader: null };
  const passes = await q<{ handle: string; tier: Tier; allocation: number }>(
    "select handle, tier, allocation from passes where holder = $1 and expires_at > now()",
    [guest],
  );
  for (const p of passes) {
    const clash = await q("select 1 from passes where holder = $1 and handle = $2 and tier = $3 and expires_at > now()", [wallet, p.handle, p.tier]);
    if (clash.length) {
      out.skipped++;
      continue;
    }
    try {
      const { tx, pass } = await sponsoredTransfer(p.handle, p.tier, guest, wallet);
      await q("delete from passes where holder = $1 and handle = $2 and tier = $3", [guest, p.handle, p.tier]);
      await storePass(pass, tx, Number(p.allocation));
      if (p.tier === "copy") {
        const from = copyAccount(guest, p.handle);
        const to = copyAccount(wallet, p.handle);
        const used = await q("select 1 from fills where account = $1 limit 1", [to]);
        if (!used.length) {
          await q("update fills set account = $2 where account = $1", [from, to]);
          await q("update equity set account = $2 where account = $1", [from, to]);
          await q("update skipped_copies set account = $2 where account = $1", [from, to]);
        }
      }
      out.passes++;
    } catch (e) {
      out.skipped++;
      log("warn", "merge.pass_failed", { handle: p.handle, tier: p.tier, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const [t] = await q<{ handle: string }>("select handle from traders where owner = $1", [guest]);
  const walletHasTrader = (await q("select 1 from traders where owner = $1", [wallet])).length > 0;
  if (t && !walletHasTrader) {
    for (const tier of TIERS) {
      const o = await getOffer(t.handle, tier);
      if (o) await sponsoredSetOffer(t.handle, tier, o.price, o.supply, wallet);
    }
    await q("update traders set owner = $2 where handle = $1", [t.handle, wallet]);
    out.trader = t.handle;
  }
  await revokeAll(guest);
  log("info", "merge.done", { passes: out.passes, skipped: out.skipped, trader: out.trader });
  return out;
}

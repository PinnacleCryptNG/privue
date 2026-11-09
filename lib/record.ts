import { q } from "./db";
import { listTraders, traderAccount, type StoredFill } from "./engine";
import { GENESIS, chainHash, leafHash } from "./ledger";
import { log } from "./log";
import { anchorCommitment, getCommitment } from "./near";

export type ChainRow = { seq: number; hash: string; prev_hash: string };

export async function chainOf(handle: string): Promise<ChainRow[]> {
  const rows = await q<ChainRow>("select seq, hash, prev_hash from fills where account = $1 order by seq asc", [traderAccount(handle)]);
  return rows.map((r) => ({ seq: Number(r.seq), hash: r.hash, prev_hash: r.prev_hash }));
}

/** Anchors every trader whose record grew since the last on-chain checkpoint. One small testnet tx per changed trader. */
export async function anchorAll(): Promise<{ handle: string; count: number; tx?: string; error?: string }[]> {
  const out: { handle: string; count: number; tx?: string; error?: string }[] = [];
  for (const t of await listTraders()) {
    const chain = await chainOf(t.handle);
    if (!chain.length) continue;
    const onchain = await getCommitment(t.handle);
    const head = chain.at(-1)!;
    if (onchain && onchain.count >= head.seq) continue;
    try {
      out.push({ handle: t.handle, count: head.seq, tx: await anchorCommitment(t.handle, head.seq, head.hash) });
    } catch (e) {
      const error = e instanceof Error ? e.message.slice(0, 200) : String(e);
      log("error", "anchor.failed", { handle: t.handle, error });
      out.push({ handle: t.handle, count: head.seq, error });
    }
  }
  return out;
}

export type RecordCheck = {
  handle: string;
  fills: number;
  linked: boolean;
  head: string | null;
  onchain: { count: number; head: string; at: string } | null;
  checkpoints: { count: number; head: string; at: string; matches: boolean }[];
  unanchored: number;
  verdict: "verified" | "pending" | "mismatch" | "empty";
  leaves?: { checked: number; ok: boolean };
  /** Newest links of the chain: sequence numbers and hashes only, never trade data. */
  recent: { seq: number; hash: string }[];
};

/**
 * Public check of a trader's record against NEAR testnet: the stored chain must link from genesis, and
 * every checkpoint ever anchored on-chain must equal the stored hash at that position. A dropped or
 * edited fill changes every later hash, so it shows up as a mismatch. With view access, the leaf
 * hashes are recomputed from the decrypted fills too.
 */
export async function checkRecord(handle: string, fills?: StoredFill[]): Promise<RecordCheck> {
  const [chain, onchain, history] = await Promise.all([
    chainOf(handle),
    getCommitment(handle),
    q<{ count: string; head: string; at: string }>("select count, head, at from commitments where handle = $1 order by count asc", [handle]),
  ]);
  let linked = true;
  let prev = GENESIS;
  chain.forEach((r, i) => {
    if (r.seq !== i + 1 || r.prev_hash !== prev) linked = false;
    prev = r.hash;
  });
  const bySeq = new Map(chain.map((r) => [r.seq, r.hash]));
  const seen = new Map(history.map((h) => [Number(h.count), { count: Number(h.count), head: h.head, at: new Date(h.at).toISOString() }]));
  if (onchain) seen.set(onchain.count, { count: onchain.count, head: onchain.head, at: new Date(onchain.at_ms).toISOString() });
  const checkpoints = [...seen.values()].sort((a, b) => a.count - b.count).map((c) => ({ ...c, matches: bySeq.get(c.count) === c.head }));
  const result: RecordCheck = {
    handle,
    fills: chain.length,
    linked,
    head: chain.at(-1)?.hash ?? null,
    onchain: onchain ? { count: onchain.count, head: onchain.head, at: new Date(onchain.at_ms).toISOString() } : null,
    checkpoints,
    unanchored: chain.length - (onchain?.count ?? 0),
    verdict: "empty",
    recent: chain.slice(-12).reverse().map((r) => ({ seq: r.seq, hash: r.hash })),
  };
  if (fills) {
    let h = GENESIS;
    let ok = fills.length === chain.length;
    fills.forEach((f, i) => {
      h = chainHash(h, leafHash(f));
      if (chain[i]?.hash !== h) ok = false;
    });
    result.leaves = { checked: fills.length, ok };
  }
  const bad = !linked || checkpoints.some((c) => !c.matches) || (onchain && onchain.count > chain.length) || result.leaves?.ok === false;
  result.verdict = !chain.length ? "empty" : bad ? "mismatch" : result.unanchored > 0 ? "pending" : "verified";
  return result;
}

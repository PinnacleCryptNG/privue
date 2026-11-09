import type { Sql } from "./db";
import { GENESIS, chainHash, fillAad, leafHash, seal, type FillBody } from "./ledger";

const iso = (v: unknown) => (v instanceof Date ? v : new Date(String(v))).toISOString();

/** Migration 2: seals plaintext fills and links them into per-account hash chains, then drops the plaintext. */
export async function sealLegacyFills(sql: Sql): Promise<void> {
  const rows = await sql<Record<string, unknown>>(
    "select id, account, side, symbol, qty, usdc, price, quote, created_at from fills where sealed is null order by account, id",
  );
  const heads = new Map<string, { seq: number; hash: string }>();
  for (const r of rows) {
    const account = String(r.account);
    if (!heads.has(account)) {
      const [last] = await sql<{ seq: number; hash: string }>(
        "select seq, hash from fills where account = $1 and seq is not null order by seq desc limit 1",
        [account],
      );
      heads.set(account, last ? { seq: Number(last.seq), hash: last.hash } : { seq: 0, hash: GENESIS });
    }
    const head = heads.get(account)!;
    const body: FillBody = {
      side: r.side as FillBody["side"],
      symbol: String(r.symbol),
      qty: Number(r.qty),
      usdc: Number(r.usdc),
      price: Number(r.price),
      quote: r.quote as FillBody["quote"],
      createdAt: iso(r.created_at),
    };
    const id = Number(r.id);
    const hash = chainHash(head.hash, leafHash(body));
    await sql(
      `update fills set seq = $2, prev_hash = $3, hash = $4, sealed = $5,
         side = null, symbol = null, qty = null, usdc = null, price = null, quote = null
       where id = $1 and sealed is null`,
      [id, head.seq + 1, head.hash, hash, seal(body, fillAad(id))],
    );
    heads.set(account, { seq: head.seq + 1, hash });
  }
}

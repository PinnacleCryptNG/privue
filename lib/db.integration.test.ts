import { describe, expect, it } from "vitest";

/**
 * Runs the real migrations and ledger against Postgres through Neon's HTTP protocol.
 * Locally: docker Postgres + local-neon-http-proxy, then
 *   TEST_DATABASE_URL=postgres://postgres:postgres@db.localtest.me:4444/postgres NEON_LOCAL_PROXY=1 npx vitest run lib/db.integration.test.ts
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("migrations and ledger on Postgres", () => {
  it("migrates, seals legacy fills, and keeps the chain consistent with Postgres", async () => {
    process.env.DATABASE_URL = url;
    process.env.FILL_KEY ??= Buffer.alloc(32, 5).toString("base64");
    const { q, MIGRATIONS, migrate } = await import("./db");
    await migrate();
    const [v] = await q<{ v: number }>("select max(version)::int as v from schema_migrations");
    expect(v.v).toBe(MIGRATIONS.at(-1)!.version);
    const [plain] = await q<{ n: number }>("select count(*)::int as n from fills where sealed is null or symbol is not null");
    expect(plain.n).toBe(0);

    const { accountFills, recordFill, traderAccount } = await import("./engine");
    const { checkRecord } = await import("./record");
    const { MARKETS } = await import("./assets");
    const handle = `itest${Date.now() % 100000}`;
    const account = traderAccount(handle);
    const quote = { signature: "ed25519:test", timestamp: new Date().toISOString(), quoteRequest: {}, quote: {} } as never;
    await Promise.all([1, 2, 3].map((n) => recordFill(account, handle, { side: "buy", asset: MARKETS[0], qty: n, usdc: 10 * n, price: 10, quote }, null)));
    const fills = await accountFills(account);
    expect(fills.map((f) => f.seq)).toEqual([1, 2, 3]);

    const { replayChain, leafHash } = await import("./ledger");
    expect(replayChain(fills.map((f) => leafHash(f)))).toEqual(fills.map((f) => f.hash));
    await q("delete from fills where account = $1", [account]);

    for (const t of await q<{ handle: string }>("select handle from traders")) {
      const r = await checkRecord(t.handle, await accountFills(traderAccount(t.handle)));
      expect(r.linked).toBe(true);
      expect(r.leaves?.ok).toBe(true);
    }
  }, 60_000);
});

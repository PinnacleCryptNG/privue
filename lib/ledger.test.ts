import { beforeAll, describe, expect, it } from "vitest";
import { GENESIS, chainHash, fillAad, leafHash, open, replayChain, seal, type FillBody } from "./ledger";
import { redact } from "./log";

const body: FillBody = {
  side: "buy",
  symbol: "NEAR",
  qty: 12.5,
  usdc: 40,
  price: 3.2,
  quote: { signature: "ed25519:abc", timestamp: "2026-11-06T12:00:00.000Z" },
  createdAt: "2026-11-06T12:00:01.000Z",
};

beforeAll(() => {
  process.env.FILL_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("sealed fills", () => {
  it("round-trips and hides the plaintext", () => {
    const s = seal(body, fillAad(1));
    expect(s).toMatch(/^v1\.[0-9a-f]{8}\./);
    expect(s).not.toContain("NEAR");
    expect(open(s, fillAad(1))).toEqual(body);
  });
  it("refuses a ciphertext moved to another row", () => {
    expect(() => open(seal(body, fillAad(1)), fillAad(2))).toThrow();
  });
  it("still opens fills sealed with a rotated-out key", () => {
    const s = seal(body, fillAad(3));
    process.env.FILL_KEYS_OLD = process.env.FILL_KEY;
    process.env.FILL_KEY = Buffer.alloc(32, 9).toString("base64");
    expect(open(s, fillAad(3)).symbol).toBe("NEAR");
  });
});

describe("hash chain", () => {
  it("changes every later head when a fill is dropped", () => {
    const leaves = [1, 2, 3, 4].map((n) => leafHash({ ...body, qty: n }));
    const full = replayChain(leaves);
    const dropped = replayChain([leaves[0], leaves[2], leaves[3]]);
    expect(full[0]).toBe(chainHash(GENESIS, leaves[0]));
    expect(dropped[1]).not.toBe(full[2]);
    expect(dropped.at(-1)).not.toBe(full.at(-1));
  });
  it("matches Postgres sha256(prev || leaf) hex", () => {
    // select encode(sha256(convert_to(repeat('0', 64) || 'ab', 'UTF8')), 'hex')
    expect(chainHash(GENESIS, "ab")).toBe("27dc4e130f54a6a25dadc20995e08355cfb5631c3e882a9f2d31e262d131838a");
  });
});

describe("structured logs", () => {
  it("redacts trade fields and secrets", () => {
    expect(redact({ handle: "atlas", symbol: "NEAR", nested: { apiKey: "x", count: 2 } })).toEqual({
      handle: "atlas",
      symbol: "[redacted]",
      nested: { apiKey: "[redacted]", count: 2 },
    });
  });
});

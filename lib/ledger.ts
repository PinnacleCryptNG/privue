import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Private fills are sealed with AES-256-GCM before they reach Postgres, and every account's fills
 * form a SHA-256 hash chain whose head is anchored on NEAR testnet. Only aggregate metadata
 * (account, trader handle, sequence, timestamps, hashes) stays in plaintext.
 */
export type FillBody = {
  side: "buy" | "sell";
  symbol: string;
  qty: number;
  usdc: number;
  price: number;
  quote: { signature: string; timestamp: string; [k: string]: unknown };
  createdAt: string;
};

export const GENESIS = "0".repeat(64);

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Leaf hash over the parts of a fill a View holder can see and re-check. */
export function leafHash(f: Pick<FillBody, "side" | "symbol" | "qty" | "usdc" | "price" | "createdAt"> & { quote: { signature: string } }): string {
  return sha256(JSON.stringify([f.side, f.symbol, f.qty, f.usdc, f.price, f.quote.signature, f.createdAt]));
}

export const chainHash = (prev: string, leaf: string) => sha256(prev + leaf);

/** Recomputes a chain from leaves; returns every head so checkpoints at any count can be compared. */
export function replayChain(leaves: string[]): string[] {
  const heads: string[] = [];
  let h = GENESIS;
  for (const l of leaves) heads.push((h = chainHash(h, l)));
  return heads;
}

function keyring(): { primary: { id: string; key: Buffer }; all: Map<string, Buffer> } {
  const raw = [process.env.FILL_KEY, ...(process.env.FILL_KEYS_OLD ?? "").split(",")].map((s) => s?.trim()).filter(Boolean) as string[];
  if (!raw.length) throw new Error("FILL_KEY is not set");
  const keys = raw.map((r) => {
    const key = Buffer.from(r, "base64");
    if (key.length !== 32) throw new Error("FILL_KEY must be 32 bytes, base64");
    return { id: createHash("sha256").update(key).digest("hex").slice(0, 8), key };
  });
  return { primary: keys[0], all: new Map(keys.map((k) => [k.id, k.key])) };
}

/** Format: v1.<key id>.<base64 iv|tag|ciphertext>. The key id lets FILL_KEY rotate without re-encrypting. */
export function seal(body: FillBody, aad: string): string {
  const { primary } = keyring();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", primary.key, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(JSON.stringify(body), "utf8"), c.final()]);
  return `v1.${primary.id}.${Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64")}`;
}

export function open(sealed: string, aad: string): FillBody {
  const [v, id, b64] = sealed.split(".");
  if (v !== "v1") throw new Error("unknown sealed fill version");
  const key = keyring().all.get(id);
  if (!key) throw new Error(`no key for sealed fill (${id})`);
  const buf = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8")) as FillBody;
}

/** Binds a ciphertext to its row, so sealed fills can't be swapped between rows. */
export const fillAad = (id: number) => `privue-fill:${id}`;

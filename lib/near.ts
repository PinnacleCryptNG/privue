import { Account } from "@near-js/accounts";
import { PublicKey } from "@near-js/crypto";
import { JsonRpcProvider } from "@near-js/providers";
import { KeyPairSigner } from "@near-js/signers";
import type { KeyPairString } from "@near-js/crypto";
import { createHash } from "node:crypto";

export const NETWORK = "testnet";
export const CONTRACT_ID = process.env.NEXT_PUBLIC_PASS_CONTRACT ?? "privue-app.testnet";
export const RPC_URL = process.env.NEAR_RPC_URL ?? "https://rpc.testnet.fastnear.com";
export const EXPLORER = "https://testnet.nearblocks.io";

export type Tier = "view" | "copy";

export type Offer = {
  handle: string;
  owner: string;
  tier: Tier;
  price: string;
  supply: number;
  sold: number;
  period_days: number;
};

export type OnchainPass = {
  handle: string;
  tier: Tier;
  holder: string;
  buyer: string;
  expires_at_ms: number;
};

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "privue", method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json();
  if (json.error) throw new Error(`NEAR RPC ${method}: ${JSON.stringify(json.error).slice(0, 200)}`);
  return json.result as T;
}

export async function view<T>(method: string, args: Record<string, unknown>): Promise<T> {
  const r = await rpc<{ result: number[] }>("query", {
    request_type: "call_function",
    finality: "optimistic",
    account_id: CONTRACT_ID,
    method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(r.result).toString("utf8")) as T;
}

export const listOffers = () => view<Offer[]>("list_offers", { limit: 100 });
export const getOffer = (handle: string, tier: Tier) => view<Offer | null>("get_offer", { handle, tier });
export const getPass = (handle: string, tier: Tier, holder: string) =>
  view<OnchainPass | null>("get_pass", { handle, tier, holder });

/** Sponsor calls share one access key, so concurrent requests can collide on nonce or expiry; retry those. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (i >= attempts || !/expired|nonce/i.test(msg)) throw e;
      await new Promise((r) => setTimeout(r, 400 * i + Math.random() * 400));
    }
  }
}

function sponsor(): Account {
  const key = process.env.NEAR_SPONSOR_KEY;
  if (!key) throw new Error("NEAR_SPONSOR_KEY is not set");
  const provider = new JsonRpcProvider({ url: RPC_URL });
  return new Account(CONTRACT_ID, provider, KeyPairSigner.fromSecretKey(key as KeyPairString));
}

/** Demo path: the Privue testnet account pays for a pass on behalf of a guest holder. */
export async function sponsoredBuy(handle: string, tier: Tier, holder: string): Promise<{ tx: string; pass: OnchainPass }> {
  const offer = await getOffer(handle, tier);
  if (!offer) throw new Error("no such offer");
  const outcome = await withRetry(() =>
    sponsor().callFunctionRaw({
      contractId: CONTRACT_ID,
      methodName: "buy_pass",
      args: { handle, tier, holder },
      deposit: BigInt(offer.price),
      gas: 50_000_000_000_000n,
    }),
  );
  const status = outcome.status as { SuccessValue?: string; Failure?: unknown };
  if (status.Failure) throw new Error(`buy_pass failed: ${JSON.stringify(status.Failure).slice(0, 200)}`);
  const pass = JSON.parse(Buffer.from(status.SuccessValue ?? "", "base64").toString("utf8")) as OnchainPass;
  return { tx: outcome.transaction.hash, pass };
}

export async function sponsoredSetOffer(handle: string, tier: Tier, priceYocto: string, supply: number, owner?: string): Promise<string> {
  const outcome = await withRetry(() =>
    sponsor().callFunctionRaw({
      contractId: CONTRACT_ID,
      methodName: "set_offer",
      args: { handle, tier, price: priceYocto, supply, period_days: 30, owner: owner ?? null },
    }),
  );
  return outcome.transaction.hash;
}

/* NEP-413 signed-message verification for wallet sign-in. */
function borshString(s: string): Buffer {
  const b = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length);
  return Buffer.concat([len, b]);
}

export function nep413Hash(message: string, nonce: Buffer, recipient: string, callbackUrl?: string | null): Buffer {
  const tag = Buffer.alloc(4);
  tag.writeUInt32LE(2 ** 31 + 413);
  const cb = callbackUrl ? Buffer.concat([Buffer.from([1]), borshString(callbackUrl)]) : Buffer.from([0]);
  const payload = Buffer.concat([tag, borshString(message), nonce, borshString(recipient), cb]);
  return createHash("sha256").update(payload).digest();
}

export async function verifyNep413(input: {
  accountId: string;
  publicKey: string;
  signature: string;
  message: string;
  nonce: Buffer;
  recipient: string;
  callbackUrl?: string | null;
}): Promise<boolean> {
  const pk = PublicKey.fromString(input.publicKey);
  const sig = Buffer.from(input.signature, "base64");
  const ok = pk.verify(new Uint8Array(nep413Hash(input.message, input.nonce, input.recipient, input.callbackUrl)), new Uint8Array(sig));
  if (!ok) return false;
  try {
    const key = await rpc<{ permission: unknown }>("query", {
      request_type: "view_access_key",
      finality: "final",
      account_id: input.accountId,
      public_key: input.publicKey,
    });
    return key.permission === "FullAccess";
  } catch {
    return false;
  }
}
export const AUTH_MESSAGE = "Sign in to Privue";

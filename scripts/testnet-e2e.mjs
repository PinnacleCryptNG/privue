// End-to-end check of the wallet path on NEAR testnet against a running Privue.
// Usage: node scripts/testnet-e2e.mjs <account.testnet> [baseUrl]
// The account's full-access key is read from ~/.near-credentials/testnet/<account>.json
// (e.g. created with `near account create-account sponsor-by-faucet-service ...`).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { Account } from "@near-js/accounts";
import { KeyPair } from "@near-js/crypto";
import { JsonRpcProvider } from "@near-js/providers";
import { KeyPairSigner } from "@near-js/signers";

const [accountId, base = "https://privue-app.vercel.app"] = process.argv.slice(2);
if (!accountId) throw new Error("usage: node scripts/testnet-e2e.mjs <account.testnet> [baseUrl]");
const CONTRACT = "privue-app.testnet";
const RPC = "https://rpc.testnet.fastnear.com";
const cred = JSON.parse(readFileSync(`${homedir()}/.near-credentials/testnet/${accountId}.json`, "utf8"));
const keyPair = KeyPair.fromString(cred.private_key);
const account = new Account(accountId, new JsonRpcProvider({ url: RPC }), new KeyPairSigner(keyPair));

let cookie = "";
async function view(method, args = {}) {
  const r = (await (await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "optimistic", account_id: CONTRACT, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } }) })).json()).result;
  return JSON.parse(Buffer.from(r.result).toString("utf8"));
}

async function api(path, init = {}) {
  const r = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json", cookie, ...(init.headers ?? {}) } });
  for (const c of r.headers.getSetCookie()) {
    const [kv] = c.split(";");
    const [k] = kv.split("=");
    cookie = [...cookie.split("; ").filter((x) => x && !x.startsWith(`${k}=`)), kv].join("; ");
  }
  return { status: r.status, body: await r.json().catch(() => null) };
}
const str = (s) => { const b = Buffer.from(s); const l = Buffer.alloc(4); l.writeUInt32LE(b.length); return Buffer.concat([l, b]); };
const check = (ok, label, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`); if (!ok) process.exitCode = 1; };
const balance = async () => Number((await account.getState()).balance.total) / 1e24;

const before = await balance();
console.log(`account ${accountId}: ${before.toFixed(4)} NEAR`);

// 1. NEP-413 sign-in
const ch = await api("/api/auth/challenge");
const recipient = new URL(base).host;
const tag = Buffer.alloc(4); tag.writeUInt32LE(2 ** 31 + 413);
const hash = createHash("sha256").update(Buffer.concat([tag, str(ch.body.message), Buffer.from(ch.body.nonce, "base64"), str(recipient), Buffer.from([0])])).digest();
const { signature } = keyPair.sign(new Uint8Array(hash));
const signIn = await api("/api/auth/near", { method: "POST", body: JSON.stringify({ accountId, publicKey: keyPair.getPublicKey().toString(), signature: Buffer.from(signature).toString("base64"), recipient }) });
check(signIn.status === 200 && signIn.body?.session?.sub === accountId, "NEP-413 wallet sign-in", JSON.stringify(signIn.body?.session ?? signIn.body));

const forged = await api("/api/auth/near", { method: "POST", headers: { cookie: "" }, body: JSON.stringify({ accountId: "privue-app.testnet", publicKey: keyPair.getPublicKey().toString(), signature: Buffer.from(signature).toString("base64"), recipient }) });
check(forged.status === 401, "sign-in as another account with my key is rejected", `${forged.status}`);

const traders = (await api("/api/traders")).body.traders ?? [];
const [viewT, copyT] = [traders[0].handle, traders[1].handle];

// 2. Buy passes from the wallet's own testnet balance
async function buy(handle, tier) {
  const offer = (await (await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "optimistic", account_id: CONTRACT, method_name: "get_offer", args_base64: Buffer.from(JSON.stringify({ handle, tier })).toString("base64") } }) })).json()).result;
  const o = JSON.parse(Buffer.from(offer.result).toString());
  const out = await account.callFunctionRaw({ contractId: CONTRACT, methodName: "buy_pass", args: { handle, tier, holder: accountId }, deposit: BigInt(o.price) + 10n ** 22n, gas: 50_000_000_000_000n });
  const ok = out.status?.SuccessValue !== undefined;
  check(ok, `buy_pass ${tier} @${handle} for ${(Number(o.price) / 1e24).toFixed(2)} NEAR`, `https://testnet.nearblocks.io/txns/${out.transaction.hash}`);
  const tx = (await (await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "EXPERIMENTAL_tx_status", params: { tx_hash: out.transaction.hash, sender_account_id: accountId, wait_until: "FINAL" } }) })).json()).result;
  const payout = tx.receipts.find((r) => r.receiver_id === o.owner && r.receipt.Action?.actions?.some((a) => a.Transfer));
  const paid = payout ? BigInt(payout.receipt.Action.actions.find((a) => a.Transfer).Transfer.deposit) : 0n;
  check(paid * 10n === BigInt(o.price) * 9n, `contract paid the trader 90% on-chain`, `${(Number(paid) / 1e24).toFixed(3)} NEAR to ${o.owner}`);
  const sync = await api("/api/passes/sync", { method: "POST", body: JSON.stringify({ handle, tier, tx: out.transaction.hash }) });
  check(sync.status === 200, `Privue reads the ${tier} pass back from the chain`, sync.status === 200 ? `expires ${new Date(sync.body.pass.expires_at_ms ?? sync.body.pass.expires_at).toISOString().slice(0, 10)}` : JSON.stringify(sync.body));
  return o;
}
await buy(viewT, "view");
await buy(copyT, "copy");

// 3. Access is enforced from the on-chain pass
const feed = await api(`/api/traders/${viewT}/feed`);
check(feed.status === 200, `view pass unlocks @${viewT}'s trade feed`, `${feed.body?.fills?.length ?? 0} fills visible`);
const blind = await api(`/api/traders/${copyT}/feed`);
check(blind.status === 403, `copy pass stays blind on @${copyT}`, blind.body?.error);
const me = (await api("/api/me")).body;
check(me?.passes?.length >= 2, "/me lists the wallet's passes", (me?.passes ?? []).map((p) => `${p.tier}@${p.handle}`).join(", "));

// 4. v2 architecture: delayed tier, on-chain record checkpoints, health
const offers = await view("list_offers", { limit: 100 });
check(offers.some((o) => o.tier === "delayed"), "contract lists delayed view passes", offers.filter((o) => o.tier === "delayed").map((o) => `@${o.handle}`).join(", "));
const rec = await api(`/api/traders/${viewT}/record`);
check(rec.status === 200 && ["verified", "pending"].includes(rec.body.verdict) && rec.body.linked, `@${viewT}'s record matches its NEAR testnet checkpoints`, `${rec.body.verdict}, ${rec.body.fills} fills, ${rec.body.checkpoints?.length ?? 0} checkpoints`);
check(rec.body.leaves?.ok === true, "view pass recomputes every leaf hash from the decrypted fills", `${rec.body.leaves?.checked ?? 0} leaves`);
const health = await api("/api/health");
check(health.body?.db?.ok && health.body?.chain?.ok, "/api/health reaches Postgres and the contract", `schema ${health.body?.db?.value?.schema}, problems: ${(health.body?.problems ?? []).join("; ") || "none"}`);

const after = await balance();
console.log(`account ${accountId}: ${after.toFixed(4)} NEAR (spent ${(before - after).toFixed(4)} testnet NEAR incl. gas)`);

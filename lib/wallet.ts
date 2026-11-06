"use client";

import { Buffer } from "buffer";
import type { WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";

export const CONTRACT_ID = process.env.NEXT_PUBLIC_PASS_CONTRACT ?? "privue-app.testnet";

let ready: Promise<{ selector: WalletSelector; modal: WalletSelectorModal }> | null = null;

function load() {
  if (typeof window !== "undefined" && !(window as unknown as { Buffer?: unknown }).Buffer) {
    (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
  }
  ready ??= (async () => {
    const [{ setupWalletSelector }, { setupModal }, { setupMeteorWallet }, { setupIntearWallet }] = await Promise.all([
      import("@near-wallet-selector/core"),
      import("@near-wallet-selector/modal-ui"),
      import("@near-wallet-selector/meteor-wallet"),
      import("@near-wallet-selector/intear-wallet"),
    ]);
    const selector = await setupWalletSelector({ network: "testnet", modules: [setupMeteorWallet(), setupIntearWallet()] });
    const modal = setupModal(selector, { contractId: CONTRACT_ID, description: "Sign in to Privue with a NEAR testnet wallet." });
    return { selector, modal };
  })();
  return ready;
}

async function connectedWallet() {
  const { selector, modal } = await load();
  if (selector.isSignedIn()) return selector.wallet();
  return new Promise<Awaited<ReturnType<WalletSelector["wallet"]>>>((resolve, reject) => {
    const sub = selector.on("signedIn", async () => {
      sub.remove();
      resolve(await selector.wallet());
    });
    modal.on("onHide", ({ hideReason }) => {
      if (hideReason === "user-triggered") reject(new Error("cancelled"));
    });
    modal.show();
  });
}

export async function finishNearSignIn(p: { accountId: string; publicKey: string; signature: string; callbackUrl?: string | null }) {
  const r = await fetch("/api/auth/near", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...p, recipient: window.location.host }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? "sign-in failed");
}

/** NEP-413 sign-in: the wallet signs a server nonce; the server checks the key is a full-access key of the account. */
export async function signInWithNear(): Promise<void> {
  const wallet = await connectedWallet();
  const { nonce, message } = await fetch("/api/auth/challenge", { cache: "no-store" }).then((r) => r.json());
  const callbackUrl = `${window.location.origin}/auth/callback`;
  const signed = await wallet.signMessage({ message, recipient: window.location.host, nonce: Buffer.from(nonce, "base64"), callbackUrl });
  if (!signed) return;
  await finishNearSignIn({ accountId: signed.accountId, publicKey: signed.publicKey, signature: signed.signature, callbackUrl });
}

export async function buyWithWallet(handle: string, tier: "view" | "copy", holder: string, priceYocto: string): Promise<string | null> {
  const wallet = await connectedWallet();
  const { actionCreators } = await import("@near-js/transactions");
  const result = await wallet.signAndSendTransaction({
    receiverId: CONTRACT_ID,
    actions: [actionCreators.functionCall("buy_pass", { handle, tier, holder }, 50_000_000_000_000n, BigInt(priceYocto))],
    callbackUrl: `${window.location.origin}/t/${handle}?bought=${tier}`,
  });
  return result && "transaction" in result ? result.transaction.hash : null;
}

export async function walletSignOut(): Promise<void> {
  if (!ready) return;
  const { selector } = await ready;
  if (selector.isSignedIn()) await (await selector.wallet()).signOut().catch(() => undefined);
}

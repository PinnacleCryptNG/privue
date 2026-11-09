"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "./MeProvider";
import { Mark } from "./Logo";

export function SignInSheet() {
  const router = useRouter();
  const { signInOpen, setSignInOpen, refresh } = useMe();
  const [busy, setBusy] = useState<"guest" | "near" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!signInOpen) return null;

  async function guest() {
    setBusy("guest");
    setError(null);
    try {
      const r = await fetch("/api/auth/guest", { method: "POST" });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "");
      await refresh();
      setSignInOpen(false);
      if (window.location.pathname === "/") router.push("/traders");
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setError(m.startsWith("too many") ? `Too many new accounts from your network. ${m.replace("too many requests, ", "Please ")}.` : "Couldn't start a guest account. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function wallet() {
    setBusy("near");
    setError(null);
    try {
      const { signInWithNear } = await import("@/lib/wallet");
      await signInWithNear();
      await refresh();
      setSignInOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg !== "cancelled") setError(msg || "Wallet sign-in failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-6" onClick={() => setSignInOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        className="fade-up w-full max-w-md rounded-t-2xl border border-line bg-panel p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center gap-3">
          <Mark size={32} />
          <h2 id="signin-title" className="text-xl font-bold tracking-[-0.02em]">Start using Privue</h2>
        </div>
        <div className="space-y-3">
          <button className="btn btn-primary w-full" onClick={guest} disabled={!!busy}>
            {busy === "guest" ? "Starting…" : "Continue as a guest"}
          </button>
          <p className="text-sm text-mute">
            Free, with no wallet or money. You can watch and copy traders straight away. Connect a wallet later and your passes come with you.
          </p>
          <div className="my-4 h-px bg-line" />
          <button className="btn btn-ghost w-full" onClick={wallet} disabled={!!busy}>
            {busy === "near" ? "Waiting for wallet…" : "Connect a NEAR testnet wallet"}
          </button>
          <p className="text-sm text-mute">For NEAR testnet wallets (Meteor or Intear). Pay for passes with your own test tokens; 90% goes to the trader.</p>
          {error ? <p className="text-sm text-loss">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

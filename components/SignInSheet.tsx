"use client";

import { useState } from "react";
import { useMe } from "./MeProvider";
import { Mark } from "./Logo";

export function SignInSheet() {
  const { signInOpen, setSignInOpen, refresh } = useMe();
  const [busy, setBusy] = useState<"guest" | "near" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!signInOpen) return null;

  async function guest() {
    setBusy("guest");
    setError(null);
    try {
      await fetch("/api/auth/guest", { method: "POST" });
      await refresh();
      setSignInOpen(false);
    } catch {
      setError("Couldn't start a demo session. Try again.");
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => setSignInOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        className="fade-up w-full max-w-md rounded-t-2xl border border-line bg-panel p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center gap-3">
          <Mark size={32} />
          <h2 id="signin-title" className="text-lg font-semibold">Sign in to Privue</h2>
        </div>
        <div className="space-y-3">
          <button className="btn btn-primary w-full" onClick={guest} disabled={!!busy}>
            {busy === "guest" ? "Starting…" : "Try it now, no wallet"}
          </button>
          <p className="text-sm text-mute">
            A private demo account. Privue pays for your first passes on NEAR testnet, so you can watch and copy traders
            straight away.
          </p>
          <div className="my-4 h-px bg-line" />
          <button className="btn btn-ghost w-full" onClick={wallet} disabled={!!busy}>
            {busy === "near" ? "Waiting for wallet…" : "Connect a NEAR testnet wallet"}
          </button>
          <p className="text-sm text-mute">Sign a message with MyNearWallet or Meteor. Buy passes from your own testnet balance.</p>
          {error ? <p className="text-sm text-loss">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

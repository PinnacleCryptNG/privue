"use client";

import { useState } from "react";

export function CreateTrader({ onCreated }: { onCreated: () => void }) {
  const [f, setF] = useState({ handle: "", name: "", bio: "", style: "Discretionary", viewPrice: "0.5", copyPrice: "1.5" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/traders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, handle: f.handle.trim().toLowerCase(), viewPrice: Number(f.viewPrice), copyPrice: Number(f.copyPrice) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't create the profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5"><span className="label">Handle</span><input className="field" required placeholder="nightowl" value={f.handle} onChange={set("handle")} /></label>
        <label className="block space-y-1.5"><span className="label">Display name</span><input className="field" required placeholder="Night Owl" value={f.name} onChange={set("name")} /></label>
      </div>
      <label className="block space-y-1.5"><span className="label">One line about your approach</span><input className="field" maxLength={160} value={f.bio} onChange={set("bio")} /></label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1.5"><span className="label">Style</span><input className="field" maxLength={30} value={f.style} onChange={set("style")} /></label>
        <label className="block space-y-1.5"><span className="label">View pass (NEAR)</span><input className="field num" inputMode="decimal" value={f.viewPrice} onChange={set("viewPrice")} /></label>
        <label className="block space-y-1.5"><span className="label">Copy pass (NEAR)</span><input className="field num" inputMode="decimal" value={f.copyPrice} onChange={set("copyPrice")} /></label>
      </div>
      <button className="btn btn-primary w-full sm:w-auto" disabled={busy}>{busy ? "Listing your passes on testnet…" : "Open a trader profile"}</button>
      {err ? <p className="text-sm text-loss">{err}</p> : null}
      <p className="text-xs text-faint">You start with $10,000 in paper USDC. 25 view passes and 10 copy passes go on sale through the Privue contract.</p>
    </form>
  );
}

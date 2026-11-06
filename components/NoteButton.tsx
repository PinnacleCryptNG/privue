"use client";

import Link from "next/link";
import { useState } from "react";

export function NoteButton({ handle }: { handle: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ text: d.body });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Couldn't write a note", bad: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <h3 className="font-semibold">Strategy note</h3>
      <p className="text-sm text-mute">
        NEAR AI reads your trade statistics, never your positions, and writes a short note for your profile. The model runs in a TEE, and Privue
        checks its attestation before sending anything. Needs 3 trades.
      </p>
      <button className="btn btn-ghost w-full" disabled={busy} onClick={run}>{busy ? "Verifying the enclave and writing…" : "Write a note"}</button>
      {msg ? (
        <p className={`text-sm ${msg.bad ? "text-loss" : "text-mute"}`}>
          {msg.text} {!msg.bad ? <Link className="text-frost" href={`/t/${handle}`}>See it on your profile</Link> : null}
        </p>
      ) : null}
    </div>
  );
}

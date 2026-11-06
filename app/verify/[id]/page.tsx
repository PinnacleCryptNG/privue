"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Proof = { fill: number; trader: string; kind: string; recordedAt: string; quoteTimestamp: string; quoteHash: string; signature: string; signatureValid: boolean };

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Proof | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/fills/${id}/verify`, { cache: "no-store" })
      .then(async (r) => ((r.ok ? setP : (e: { error: string }) => setErr(e.error)) as (x: unknown) => void)(await r.json()))
      .catch(() => setErr("Couldn't load this fill."));
  }, [id]);
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">Fill #{id}</h1>
      <p className="mt-2 text-mute">
        Privue stores the full signed quote that NEAR Intents 1Click returned for every fill, and checks its ed25519 signature again here. You see the
        proof, not the trade.
      </p>
      {err ? <p className="mt-8 text-loss">{err}</p> : null}
      {p ? (
        <div className="card mt-8 divide-y divide-line">
          <Row k="Signature" v={p.signatureValid ? "Valid, signed by 1Click" : "Does not verify"} c={p.signatureValid ? "text-gain" : "text-loss"} />
          <Row k="Trader" v={<Link className="text-frost" href={`/t/${p.trader}`}>@{p.trader}</Link>} />
          <Row k="Account" v={p.kind === "copy" ? "Copy account (mirrored fill)" : "Trader account"} />
          <Row k="Quoted at" v={new Date(p.quoteTimestamp).toUTCString()} />
          <Row k="Recorded at" v={new Date(p.recordedAt).toUTCString()} />
          <Row k="Quote hash" v={<span className="break-all font-normal text-mute">{p.quoteHash}</span>} />
          <Row k="1Click signature" v={<span className="break-all font-normal text-mute">{p.signature}</span>} />
        </div>
      ) : null}
    </div>
  );
}

function Row({ k, v, c = "" }: { k: string; v: React.ReactNode; c?: string }) {
  return (
    <div className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[9rem_1fr]">
      <span className="text-mute">{k}</span>
      <span className={`min-w-0 font-medium ${c}`}>{v}</span>
    </div>
  );
}

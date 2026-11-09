"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { RecordCheck } from "@/lib/record";

const VERDICT: Record<RecordCheck["verdict"], { text: string; tone: string }> = {
  verified: { text: "Matches NEAR testnet", tone: "text-gain" },
  pending: { text: "Matches; newest fills not anchored yet", tone: "text-gain" },
  mismatch: { text: "Does not match the chain", tone: "text-loss" },
  empty: { text: "No fills yet", tone: "text-mute" },
};

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

export default function RecordPage() {
  const { handle } = useParams<{ handle: string }>();
  const [r, setR] = useState<RecordCheck | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/traders/${handle}/record`, { cache: "no-store" })
      .then(async (x) => (x.ok ? setR(await x.json()) : setErr((await x.json()).error)))
      .catch(() => setErr("Couldn't load this record."));
  }, [handle]);
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">@{handle}&apos;s record</h1>
      <p className="mt-2 text-mute">
        Every fill is sealed and linked into a SHA-256 hash chain. Privue anchors the chain&apos;s head on the passes contract on NEAR testnet, and the
        contract only accepts a longer chain. If a fill were dropped or edited, every later hash would change and the checkpoints below would stop matching.
        You see hashes, not trades.
      </p>
      {err ? <p className="mt-8 text-loss">{err}</p> : null}
      {r ? (
        <>
          <div className="card mt-8 divide-y divide-line">
            <Row k="Verdict" v={VERDICT[r.verdict].text} c={VERDICT[r.verdict].tone} />
            <Row k="Fills in the record" v={String(r.fills)} />
            <Row k="Chain links from genesis" v={r.linked ? "Yes" : "No"} c={r.linked ? "text-gain" : "text-loss"} />
            <Row k="Latest on-chain checkpoint" v={r.onchain ? `${r.onchain.count} fills · ${new Date(r.onchain.at).toUTCString()}` : "None yet"} />
            <Row k="Waiting to be anchored" v={String(Math.max(0, r.unanchored))} />
            {r.leaves ? <Row k="Leaf hashes (your view pass)" v={r.leaves.ok ? `All ${r.leaves.checked} recomputed and match` : "Mismatch"} c={r.leaves.ok ? "text-gain" : "text-loss"} /> : null}
            {r.head ? <Row k="Current head" v={<span className="break-all font-normal text-mute">{r.head}</span>} /> : null}
          </div>
          {r.checkpoints.length ? (
            <section className="mt-8">
              <h2 className="font-medium">Checkpoints on NEAR testnet</h2>
              <ul className="card mt-3 divide-y divide-line text-sm">
                {r.checkpoints.map((c) => (
                  <li key={c.count} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="num">after fill {c.count}</span>
                    <span className="num text-mute">{short(c.head)}</span>
                    <span className={c.matches ? "text-gain" : "text-loss"}>{c.matches ? "matches" : "mismatch"}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <p className="mt-6 text-sm text-mute">
            Check it yourself: call <code className="text-text">commit_log</code> or <code className="text-text">get_commitment</code> on{" "}
            <a className="text-frost" href="https://testnet.nearblocks.io/address/privue-app.testnet">privue-app.testnet</a>.{" "}
            <Link className="text-frost" href={`/t/${handle}`}>Back to @{handle}</Link>
          </p>
        </>
      ) : null}
    </div>
  );
}

function Row({ k, v, c }: { k: string; v: React.ReactNode; c?: string }) {
  return (
    <div className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[13rem_1fr]">
      <span className="text-mute">{k}</span>
      <span className={`font-medium ${c ?? ""}`}>{v}</span>
    </div>
  );
}

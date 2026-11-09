"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EquityChart } from "@/components/EquityChart";
import { LockedLedger, OpenLedger, type FeedFill } from "@/components/Ledger";
import { useMe } from "@/components/MeProvider";
import { PassPanel } from "@/components/PassPanel";
import { StatGrid } from "@/components/Stats";
import { ago } from "@/lib/format";
import type { PublicTrader } from "@/lib/public";

type Detail = {
  trader: PublicTrader;
  curve: { ts: string; value: number }[];
  access: { owner: boolean; view: boolean; delayed: boolean; copy: boolean };
  note: { body: string; model: string; created_at: string; proof: { signature: { status: string; signingAddress: string | null }; attestation: { verifiedAt: string } } } | null;
  signedFills: number;
  latestFill: number | null;
};

export default function TraderPage() {
  const { handle } = useParams<{ handle: string }>();
  const search = useSearchParams();
  const { me, refresh } = useMe();
  const [d, setD] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [feed, setFeed] = useState<FeedFill[] | null>(null);
  const [hidden, setHidden] = useState(0);

  const load = useCallback(async () => {
    const r = await fetch(`/api/traders/${handle}`, { cache: "no-store" });
    if (r.status === 404) return setMissing(true);
    const data: Detail = await r.json();
    setD(data);
    if (data.access.view || data.access.delayed) {
      const f = await fetch(`/api/traders/${handle}/feed`, { cache: "no-store" }).then((x) => x.json());
      setFeed(f.fills ?? []);
      setHidden(f.hidden ?? 0);
    } else setFeed(null);
  }, [handle]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, me?.session?.sub]);

  useEffect(() => {
    const tier = search.get("bought");
    if (!tier || !me?.session) return;
    fetch("/api/passes/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle, tier, tx: search.get("transactionHashes") }) })
      .then(() => refresh())
      .then(load);
  }, [search, me?.session, handle, refresh, load]);

  if (missing) return <div className="mx-auto max-w-6xl px-5 py-24 text-mute">No trader called @{handle}. <Link className="text-amber" href="/traders">See all traders</Link></div>;
  if (!d) return <div className="mx-auto max-w-6xl px-5 py-24 text-mute">Loading…</div>;
  const t = d.trader;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="display text-5xl">{t.name}</h1>
            <span className="text-mute">@{t.handle}</span>
          </div>
          <p className="mt-3 max-w-xl text-lg text-mute">{t.bio}</p>
          <p className="label mt-2">
            {t.style} · trades {t.markets.join(", ")} · {t.stats.lastFillAt ? `last trade ${ago(t.stats.lastFillAt)}` : "no trades yet"} · {t.copiers} copying
            {t.isBot ? " · automated demo trader" : ""}
          </p>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-bold tracking-[-0.015em]">Equity</h2>
            <span className="label">started with $10,000 practice money</span>
          </div>
          <EquityChart points={d.curve} start={t.stats.startCash} />
        </div>

        <StatGrid s={t.stats} />

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold tracking-[-0.015em]">Trades</h2>
            <span className="label">
              <Link href={`/verify/record/${t.handle}`} className="text-amber">Check this record on NEAR</Link>
            </span>
          </div>
          {d.access.view && feed ? (
            <OpenLedger fills={feed} />
          ) : d.access.delayed && feed ? (
            <>
              <p className="text-sm text-mute">Delayed view: trades appear 24 hours after they happen.{hidden ? ` ${hidden} newer ${hidden === 1 ? "trade is" : "trades are"} still under the delay.` : ""}</p>
              <OpenLedger fills={feed} />
            </>
          ) : d.access.copy ? (
            <p className="card px-4 py-5 text-sm text-mute">
              You&apos;re copying {t.name}. Their trades are placed in your practice account automatically, but stay hidden from you.{" "}
              <Link href="/me" className="text-amber">See your results</Link>
            </p>
          ) : (
            <LockedLedger count={d.signedFills} latest={d.latestFill} />
          )}
        </section>

        {d.note ? (
          <section className="card p-5">
            <h2 className="font-bold tracking-[-0.015em]">Strategy note</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-mute">{d.note.body}</p>
            <p className="label mt-3">
              Written by {d.note.model} on NEAR AI Cloud from trade statistics only, never positions · TEE attestation verified
              {d.note.proof.signature.status === "verified" ? " · response signed by the model enclave" : " · response signature unavailable"} ·{" "}
              {ago(d.note.created_at)}
            </p>
          </section>
        ) : null}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <div><h2 className="font-bold tracking-[-0.015em]">Follow {t.name}</h2><p className="mt-1 text-sm text-mute">Free while Privue runs on NEAR testnet.</p></div>
        <PassPanel offers={t.offers} owner={d.access.owner} held={{ view: d.access.view && !d.access.owner, delayed: d.access.delayed, copy: d.access.copy }} onBought={load} />
        <p className="px-1 text-xs text-faint">Passes are recorded on NEAR testnet. Trades use practice money at real NEAR Intents prices; no real money moves.</p>
      </aside>
    </div>
  );
}

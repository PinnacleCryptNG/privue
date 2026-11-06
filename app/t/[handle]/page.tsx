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
  access: { owner: boolean; view: boolean; copy: boolean };
  note: { body: string; model: string; created_at: string } | null;
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

  const load = useCallback(async () => {
    const r = await fetch(`/api/traders/${handle}`, { cache: "no-store" });
    if (r.status === 404) return setMissing(true);
    const data: Detail = await r.json();
    setD(data);
    if (data.access.view) {
      const f = await fetch(`/api/traders/${handle}/feed`, { cache: "no-store" }).then((x) => x.json());
      setFeed(f.fills ?? []);
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

  if (missing) return <div className="mx-auto max-w-6xl px-5 py-24 text-mute">No trader called @{handle}. <Link className="text-frost" href="/traders">See all traders</Link></div>;
  if (!d) return <div className="mx-auto max-w-6xl px-5 py-24 text-mute">Loading…</div>;
  const t = d.trader;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl font-semibold tracking-[-0.02em]">{t.name}</h1>
            <span className="text-mute">@{t.handle}</span>
          </div>
          <p className="mt-2 max-w-xl text-mute">{t.bio}</p>
          <p className="label mt-2">
            {t.style} · trades {t.markets.join(", ")} · {t.stats.lastFillAt ? `last trade ${ago(t.stats.lastFillAt)}` : "no trades yet"} · {t.copiers} copying
            {t.isBot ? " · demo strategy" : ""}
          </p>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-medium">Equity</h2>
            <span className="label">hourly, from $10,000 paper</span>
          </div>
          <EquityChart points={d.curve} start={t.stats.startCash} />
        </div>

        <StatGrid s={t.stats} />

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Trades</h2>
            <span className="label">{d.signedFills} signed fills</span>
          </div>
          {d.access.view && feed ? (
            <OpenLedger fills={feed} />
          ) : d.access.copy ? (
            <p className="card px-4 py-5 text-sm text-mute">
              You&apos;re copying {t.name}. Copy passes are blind: your account mirrors each trade, but the trades stay hidden.{" "}
              <Link href="/me" className="text-frost">See your copy account</Link>
            </p>
          ) : (
            <LockedLedger count={d.signedFills} latest={d.latestFill} />
          )}
        </section>

        {d.note ? (
          <section className="card p-5">
            <h2 className="font-medium">Strategy note</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-mute">{d.note.body}</p>
            <p className="label mt-3">Written by {d.note.model} on NEAR AI Cloud, inside a TEE · {ago(d.note.created_at)}</p>
          </section>
        ) : null}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <h2 className="font-medium">Passes</h2>
        <PassPanel offers={t.offers} owner={d.access.owner} held={{ view: d.access.view && !d.access.owner, copy: d.access.copy }} onBought={load} />
        <p className="px-1 text-xs text-faint">Passes are minted by the Privue contract on NEAR testnet. Trades are paper fills at live NEAR Intents quotes.</p>
      </aside>
    </div>
  );
}

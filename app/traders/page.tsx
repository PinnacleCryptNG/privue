"use client";

import { useEffect, useState } from "react";
import { TraderRow } from "@/components/TraderRow";
import type { PublicTrader } from "@/lib/public";

export default function TradersPage() {
  const [list, setList] = useState<PublicTrader[] | null>(null);
  useEffect(() => {
    fetch("/api/traders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setList(d.traders));
  }, []);
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">Traders</h1>
      <p className="mt-2 max-w-xl text-mute">Ranked by return. Records are built from signed NEAR Intents quotes. Trades stay hidden unless you hold a pass.</p>
      <div className="mt-8 space-y-3">
        {list === null ? <p className="text-mute">Loading…</p> : list.map((t) => <TraderRow key={t.handle} t={t} />)}
      </div>
    </div>
  );
}

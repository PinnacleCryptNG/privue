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
      <h1 className="display text-5xl">Traders</h1>
      <p className="mt-4 max-w-xl text-lg text-mute">Ranked by return. Every record is built from signed NEAR Intents quotes and anchored on NEAR. The trades stay behind the blinds unless you hold a pass.</p>
      <div className="mt-10 space-y-3">
        {list === null ? <p className="text-mute">Loading…</p> : list.map((t, i) => <TraderRow key={t.handle} t={t} rank={i + 1} />)}
      </div>
    </div>
  );
}

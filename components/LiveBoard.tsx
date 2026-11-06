"use client";

import { useEffect, useState } from "react";
import type { PublicTrader } from "@/lib/public";
import { TraderRow } from "./TraderRow";

export function LiveBoard() {
  const [list, setList] = useState<PublicTrader[] | null>(null);
  useEffect(() => {
    fetch("/api/traders")
      .then((r) => r.json())
      .then((d) => setList(d.traders ?? []))
      .catch(() => setList([]));
  }, []);
  if (!list) return <div className="card h-40 animate-pulse" />;
  return <div className="space-y-3">{list.slice(0, 4).map((t) => <TraderRow key={t.handle} t={t} />)}</div>;
}

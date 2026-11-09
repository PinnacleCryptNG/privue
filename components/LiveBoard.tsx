"use client";

import { useTraders } from "./landing/useTraders";
import { TraderRow } from "./TraderRow";

export function LiveBoard() {
  const list = useTraders();
  if (!list) return <div className="card h-40 animate-pulse" />;
  return <div className="space-y-3">{list.slice(0, 4).map((t, i) => <TraderRow key={t.handle} t={t} rank={i + 1} />)}</div>;
}

"use client";

import { useEffect, useState } from "react";
import { pct, tone } from "@/lib/format";
import type { PublicTrader } from "@/lib/public";

const ROWS = [
  ["BUY", "NEAR", "412.08", "$1,540.12"],
  ["SELL", "SOL", "9.114", "$826.40"],
  ["BUY", "ETH", "0.3912", "$871.95"],
  ["SELL", "NEAR", "388.50", "$1,452.77"],
  ["BUY", "ZEC", "1.0821", "$1,460.03"],
];

/** Illustrative rows: the sweep shows what a pass holder sees; the stats are live. */
export function HeroLedger() {
  const [top, setTop] = useState<PublicTrader | null>(null);
  useEffect(() => {
    fetch("/api/traders")
      .then((r) => r.json())
      .then((d) => setTop(d.traders?.[0] ?? null))
      .catch(() => undefined);
  }, []);
  const s = top?.stats;
  return (
    <div className="card relative overflow-hidden p-5 shadow-[0_30px_80px_-30px_rgba(111,127,224,0.35)]">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="font-semibold">{top?.name ?? "Atlas"}</div>
          <div className="label">{top ? `${top.style} · ${top.markets.join(", ")}` : "Momentum · NEAR, SOL"}</div>
        </div>
        <div className="text-right">
          <div className={`num text-2xl font-semibold ${s ? tone(s.pnl) : "text-mute"}`}>{s ? pct(s.pnlPct) : "–"}</div>
          <div className="label">live return</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-line bg-line text-sm">
        {[
          ["Win rate", s?.winRate == null ? "–" : pct(s.winRate, 0, false)],
          ["Drawdown", s ? pct(-s.maxDrawdown) : "–"],
          ["Signed fills", s ? String(s.totalFills) : "–"],
        ].map(([k, v]) => (
          <div key={k} className="bg-raise px-3 py-2.5">
            <div className="label">{k}</div>
            <div className="num mt-0.5 font-medium">{v}</div>
          </div>
        ))}
      </div>
      <div className="relative mt-4 overflow-hidden rounded-[10px] border border-line">
        {ROWS.map((r, i) => (
          <div key={i} className="grid grid-cols-[3.2rem_1fr_auto] gap-3 border-b border-line px-3.5 py-2.5 text-sm last:border-0">
            <span className={`frosted ${r[0] === "BUY" ? "text-gain" : "text-loss"}`}>{r[0]}</span>
            <span className="frosted">{r[1]} · {r[2]}</span>
            <span className="frosted num">{r[3]}</span>
          </div>
        ))}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[20%] border-y border-frost/40 bg-frost/[0.06] backdrop-blur-0"
          style={{ animation: "sweep 5.5s cubic-bezier(.6,0,.3,1) infinite" }}
        />
      </div>
      <p className="label mt-3">The record is public. The trades are for pass holders.</p>
    </div>
  );
}

import { pct, signedUsd, tone, usd } from "@/lib/format";
import type { PublicStats } from "@/lib/stats";

export function StatGrid({ s }: { s: PublicStats }) {
  const items = [
    { k: "Return", v: pct(s.pnlPct), c: tone(s.pnl) },
    { k: "P&L", v: signedUsd(s.pnl), c: tone(s.pnl) },
    { k: "Win rate", v: s.winRate == null ? "–" : pct(s.winRate, 0, false), c: "" },
    { k: "Max drawdown", v: pct(-s.maxDrawdown), c: s.maxDrawdown > 0 ? "text-loss" : "text-mute" },
    { k: "Closed trades", v: String(s.closedTrades), c: "" },
    { k: "Equity", v: usd(s.equity, 0), c: "" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.k} className="bg-panel px-4 py-3.5">
          <dt className="label">{i.k}</dt>
          <dd className={`num mt-1 text-lg font-medium ${i.c}`}>{i.v}</dd>
        </div>
      ))}
    </dl>
  );
}

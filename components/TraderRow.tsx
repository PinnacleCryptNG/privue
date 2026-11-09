import Link from "next/link";
import { ago, near, pct, tone } from "@/lib/format";
import type { PublicTrader } from "@/lib/public";
import { EquityChart } from "./EquityChart";

export function TraderRow({ t, curve, rank }: { t: PublicTrader; curve?: { ts: string; value: number }[]; rank?: number }) {
  const view = t.offers.find((o) => o.tier === "view");
  const copy = t.offers.find((o) => o.tier === "copy");
  return (
    <Link
      href={`/t/${t.handle}`}
      className="card group grid gap-4 p-4 transition-colors hover:border-amber/50 sm:grid-cols-[auto_1.3fr_1fr_auto] sm:items-center sm:gap-6 sm:p-5"
    >
      {rank ? <span className="num hidden w-7 text-sm font-semibold text-faint sm:block">{String(rank).padStart(2, "0")}</span> : <span className="hidden sm:block" />}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-[-0.02em] group-hover:text-amber">{t.name}</span>
          <span className="text-sm text-faint">@{t.handle}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-mute">
          {t.style} · {t.markets.slice(0, 3).join(", ")} · {t.stats.lastFillAt ? `last trade ${ago(t.stats.lastFillAt)}` : "no trades yet"}
        </p>
      </div>
      <div className="flex items-center gap-5">
        <div>
          <div className={`num text-2xl font-bold tracking-[-0.03em] ${tone(t.stats.pnl)}`}>{pct(t.stats.pnlPct)}</div>
          <div className="label">
            {t.stats.winRate == null ? "no closed trades yet" : `${pct(t.stats.winRate, 0, false)} wins · ${t.stats.closedTrades} closed`}
          </div>
        </div>
        {curve ? <div className="hidden w-28 md:block"><EquityChart points={curve} start={t.stats.startCash} height={40} /></div> : null}
      </div>
      <div className="num flex gap-4 text-sm sm:flex-col sm:gap-0.5 sm:text-right">
        {view ? <span><span className="text-mute">View </span>{near(view.price)}</span> : null}
        {copy ? <span><span className="text-mute">Copy </span>{near(copy.price)} <span className="text-faint">· {copy.supply - copy.sold} left</span></span> : null}
      </div>
    </Link>
  );
}

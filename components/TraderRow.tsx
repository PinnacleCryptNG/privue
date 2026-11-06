import Link from "next/link";
import { ago, near, pct, tone } from "@/lib/format";
import type { PublicTrader } from "@/lib/public";
import { EquityChart } from "./EquityChart";

export function TraderRow({ t, curve }: { t: PublicTrader; curve?: { ts: string; value: number }[] }) {
  const view = t.offers.find((o) => o.tier === "view");
  const copy = t.offers.find((o) => o.tier === "copy");
  return (
    <Link href={`/t/${t.handle}`} className="card group grid gap-4 p-4 transition-colors hover:border-faint sm:grid-cols-[1.3fr_1fr_auto] sm:items-center sm:p-5">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold">{t.name}</span>
          <span className="text-sm text-faint">@{t.handle}</span>
        </div>
        <p className="mt-0.5 text-sm text-mute">
          {t.style} · {t.markets.slice(0, 3).join(", ")} · last trade {ago(t.stats.lastFillAt)}
        </p>
      </div>
      <div className="flex items-center gap-5">
        <div>
          <div className={`num text-xl font-semibold ${tone(t.stats.pnl)}`}>{pct(t.stats.pnlPct)}</div>
          <div className="label">
            {t.stats.winRate == null ? "no closed trades" : `${pct(t.stats.winRate, 0, false)} wins`} · {t.stats.closedTrades} closed
          </div>
        </div>
        {curve ? <div className="hidden w-28 md:block"><EquityChart points={curve} start={t.stats.startCash} height={40} /></div> : null}
      </div>
      <div className="flex gap-4 text-sm sm:flex-col sm:gap-0.5 sm:text-right">
        {view ? <span><span className="text-mute">View </span>{near(view.price)}</span> : null}
        {copy ? <span><span className="text-mute">Copy </span>{near(copy.price)} · {copy.supply - copy.sold} left</span> : null}
      </div>
    </Link>
  );
}

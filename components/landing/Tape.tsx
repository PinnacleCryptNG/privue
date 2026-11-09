"use client";

import Link from "next/link";
import { near, pct, tone } from "@/lib/format";
import { useTraders } from "./useTraders";

/** A slow ticker of every live trader's public record. */
export function Tape() {
  const list = useTraders();
  if (!list?.length) return <div className="h-14 border-y border-line" />;
  const items = Array.from({ length: Math.max(2, Math.ceil(12 / list.length)) }, () => list).flat();
  const track = (
    <div className="flex shrink-0 items-center">
      {items.map((t, i) => {
        const view = t.offers.find((o) => o.tier === "view");
        return (
          <Link key={i} href={`/t/${t.handle}`} className="flex items-center gap-3 whitespace-nowrap px-7 text-sm hover:text-amber">
            <span className="font-semibold">{t.name}</span>
            <span className={`num font-semibold ${tone(t.stats.pnl)}`}>{pct(t.stats.pnlPct)}</span>
            <span className="num text-mute">{t.stats.totalFills} fills</span>
            {view ? <span className="num text-faint">view {near(view.price)}</span> : null}
            <span className="ml-4 h-3 w-px bg-line" />
          </Link>
        );
      })}
    </div>
  );
  return (
    <div className="group relative overflow-hidden border-y border-line bg-panel/60 py-4 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className="marquee-track flex w-max group-hover:[animation-play-state:paused]" style={{ animation: "marquee 60s linear infinite" }}>
        {track}
        {track}
      </div>
    </div>
  );
}

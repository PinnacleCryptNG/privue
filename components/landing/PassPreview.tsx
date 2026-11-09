"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconCopy, IconRecord, IconView } from "@/components/Icons";
import { pct, tone } from "@/lib/format";
import { useTraders } from "./useTraders";

const TABS = [
  { id: "public", label: "Anyone", Icon: IconRecord, caption: "Everyone sees the results. The trades behind them stay hidden." },
  { id: "view", label: "View pass", Icon: IconView, caption: "Pass holders see each trade as it happens." },
  { id: "copy", label: "Copy pass", Icon: IconCopy, caption: "Copiers get the same trades placed in their own account, without seeing them." },
] as const;
type Tab = (typeof TABS)[number]["id"];

const SAMPLE = [
  { side: "BUY", sym: "NEAR", size: "$1,200", at: "$2.41" },
  { side: "SELL", sym: "SOL", size: "$800", at: "$168.20" },
  { side: "BUY", sym: "ETH", size: "$1,500", at: "$3,512" },
];

/** One trader page, seen through each kind of access. Tabs cycle until the visitor picks one. */
export function PassPreview() {
  const list = useTraders();
  const t = list?.[0];
  const s = t?.stats;
  const [tab, setTab] = useState<Tab>("public");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTab((x) => TABS[(TABS.findIndex((y) => y.id === x) + 1) % TABS.length].id), 4200);
    return () => clearInterval(id);
  }, [auto]);

  const current = TABS.find((x) => x.id === tab)!;
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[40px] bg-amber/10 blur-3xl" />
      <div className="card overflow-hidden shadow-[0_40px_120px_-40px_rgba(245,184,61,0.35)]">
        <div role="tablist" aria-label="What each person sees" className="grid grid-cols-3 border-b border-line">
          {TABS.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => {
                setTab(x.id);
                setAuto(false);
              }}
              className={`relative flex items-center justify-center gap-2 px-2 py-3.5 text-sm font-semibold transition-colors ${tab === x.id ? "text-text" : "text-faint hover:text-mute"}`}
            >
              <x.Icon size={17} className={tab === x.id ? "text-amber" : ""} />
              <span className="truncate">{x.label}</span>
              {tab === x.id ? <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-sm bg-amber" /> : null}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <div className="truncate text-lg font-bold tracking-[-0.02em]">{t?.name ?? "Loading…"}</div>
            <div className="label truncate">{t ? `${t.style} · ${t.markets.join(", ")}` : "\u00a0"}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className={`num text-2xl font-bold tracking-[-0.03em] ${s ? tone(s.pnl) : "text-faint"}`}>{s ? pct(s.pnlPct) : "–"}</div>
            <div className="label">return</div>
          </div>
        </div>

        <div className="min-h-[13.5rem] px-5 pb-5">
          {tab === "copy" ? (
            <div className="rounded-[10px] border border-line bg-ink/60 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">Your copy account</span>
                <span className={`num font-semibold ${s ? tone(s.pnl) : ""}`}>{s ? pct(s.pnlPct) : "–"}</span>
              </div>
              <p className="mt-1 text-sm text-mute">Every trade {t?.name ?? "they"} makes is placed in your account too, sized to your balance.</p>
              <div className="mt-4 space-y-2">
                {SAMPLE.map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="label w-20 shrink-0">Copied</span>
                    <span className="h-2.5 flex-1 rounded-full bg-raise" />
                  </div>
                ))}
              </div>
              <p className="label mt-4">You see the result, never the trades.</p>
            </div>
          ) : tab === "view" ? (
            <div className="rounded-[10px] border border-line">
              {SAMPLE.map((r, i) => (
                <div key={i} className={`grid grid-cols-[3.2rem_1fr_auto] items-center gap-3 px-4 py-3 text-sm ${i ? "border-t border-line" : ""}`}>
                  <span className={`font-semibold ${r.side === "BUY" ? "text-gain" : "text-loss"}`}>{r.side}</span>
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{r.sym}</span>
                    <span className="num text-mute"> at {r.at}</span>
                  </span>
                  <span className="num">{r.size}</span>
                </div>
              ))}
              <p className="label border-t border-line px-4 py-2.5">Example rows. Real trades appear here once you hold a pass.</p>
            </div>
          ) : (
            <div>
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-line bg-line text-sm">
                {[
                  ["Win rate", s?.winRate == null ? "None closed" : pct(s.winRate, 0, false)],
                  ["Worst dip", s ? pct(-s.maxDrawdown) : "–"],
                  ["Trades", s ? String(s.totalFills) : "–"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-panel px-3 py-3">
                    <dt className="label">{k}</dt>
                    <dd className="num mt-0.5 font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 space-y-2 rounded-[10px] border border-dashed border-line p-4">
                {SAMPLE.map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="label w-20 shrink-0">Hidden</span>
                    <span className="h-2.5 flex-1 rounded-full bg-raise" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-start justify-between gap-4 px-1">
        <p className="text-sm text-mute">{current.caption}</p>
        {t ? (
          <Link href={`/t/${t.handle}`} className="link shrink-0 text-sm font-medium">
            Open {t.name}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

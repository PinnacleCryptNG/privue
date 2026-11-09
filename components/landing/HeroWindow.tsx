"use client";

import Link from "next/link";
import { useState } from "react";
import { Blinds } from "@/components/Blinds";
import { pct, tone } from "@/lib/format";
import { useRecord, useTraders } from "./useTraders";

const SLATS = 8;

/** A live trader behind blinds: the record outside is real, the slats carry its real fill hashes. */
export function HeroWindow() {
  const list = useTraders();
  const top = list?.[0];
  const rec = useRecord(top?.handle);
  const [open, setOpen] = useState(false);
  const s = top?.stats;
  const rows = Array.from({ length: SLATS }, (_, i) => {
    const r = rec?.recent[i];
    if (rec && !r) return <span key={i} />;
    return (
      <div key={i} className="num flex w-full items-center justify-between gap-3 text-[0.78rem] text-faint">
        <span>{r ? `fill ${String(r.seq).padStart(3, "0")}` : "fill ···"}</span>
        <span className="truncate">{r ? `${r.hash.slice(0, 18)}…${r.hash.slice(-6)}` : "sealed"}</span>
        <span className="hidden text-mute sm:inline">{r ? "sealed" : ""}</span>
      </div>
    );
  });
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-10 -z-10 rounded-[40px] bg-amber/10 blur-3xl" />
      <div className="card overflow-hidden shadow-[0_40px_120px_-40px_rgba(245,184,61,0.35)]">
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <Link href={top ? `/t/${top.handle}` : "/traders"} className="text-lg font-bold tracking-[-0.02em] hover:text-amber">
              {top?.name ?? "Loading trader"}
            </Link>
            <div className="label truncate">{top ? `${top.style} · ${top.markets.join(", ")}` : "\u00a0"}</div>
          </div>
          <div className="text-right">
            <div className={`num text-3xl font-bold tracking-[-0.03em] ${s ? tone(s.pnl) : "text-faint"}`}>{s ? pct(s.pnlPct) : "–"}</div>
            <div className="label">return, paper</div>
          </div>
        </div>
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close the blinds" : "Tilt the blinds"}
        >
          <Blinds
            rows={rows}
            count={SLATS}
            open={open}
            behind={
              <div className="text-ink">
                <p className="text-2xl font-extrabold tracking-[-0.03em]">The trades live here.</p>
                <p className="mt-1 text-sm font-medium">Only pass holders see them.</p>
              </div>
            }
          />
        </button>
        <dl className="grid grid-cols-3 border-t border-line text-sm">
          {[
            ["Win rate", s?.winRate == null ? "–" : pct(s.winRate, 0, false)],
            ["Max drawdown", s ? pct(-s.maxDrawdown) : "–"],
            ["On NEAR", rec ? (rec.verdict === "verified" ? "Anchored" : rec.verdict === "pending" ? "Anchoring" : rec.verdict === "empty" ? "No fills" : "Mismatch") : "–"],
          ].map(([k, v], i) => (
            <div key={k} className={`px-5 py-3.5 ${i ? "border-l border-line" : ""}`}>
              <dt className="label">{k}</dt>
              <dd className="num mt-0.5 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="label mt-3 px-1">
        Live from @{top?.handle ?? "atlas"}. Each slat is one sealed fill in its hash chain. Tap to tilt.
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { MARKETS } from "@/lib/assets";
import { usd } from "@/lib/format";

type Result = { fillId: number; side: string; symbol: string; qty: number; usdc: number; price: number; mirrored: number; skipped: number };

export function TradeTicket({ handle, onFilled }: { handle: string; onFilled?: () => void }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [symbol, setSymbol] = useState("NEAR");
  const [usdc, setUsdc] = useState("500");
  const [fraction, setFraction] = useState(1);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      const body = side === "buy" ? { handle, side, symbol, usdc: Number(usdc) } : { handle, side, symbol, fraction };
      const r = await fetch("/api/trade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRes(d);
      onFilled?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div className="grid grid-cols-2 rounded-[10px] border border-line p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`h-9 rounded-[7px] text-sm font-medium capitalize ${side === s ? (s === "buy" ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss") : "text-mute"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <label className="block space-y-1.5">
        <span className="label">Market</span>
        <select className="field" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {MARKETS.map((m) => (
            <option key={m.symbol} value={m.symbol}>{m.symbol} / USDC</option>
          ))}
        </select>
      </label>
      {side === "buy" ? (
        <label className="block space-y-1.5">
          <span className="label">Spend (paper USDC)</span>
          <input className="field num" inputMode="decimal" value={usdc} onChange={(e) => setUsdc(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
      ) : (
        <div className="space-y-1.5">
          <span className="label">Sell part of the position</span>
          <div className="grid grid-cols-3 gap-2">
            {[0.25, 0.5, 1].map((f) => (
              <button key={f} type="button" onClick={() => setFraction(f)} className={`btn h-10 ${fraction === f ? "btn-primary" : "btn-ghost"}`}>
                {f * 100}%
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Getting a live quote…" : `${side === "buy" ? "Buy" : "Sell"} ${symbol} at the live quote`}
      </button>
      {err ? <p className="text-sm text-loss">{err}</p> : null}
      {res ? (
        <p className="text-sm text-mute">
          <span className={res.side === "buy" ? "text-gain" : "text-loss"}>{res.side === "buy" ? "Bought" : "Sold"}</span>{" "}
          <span className="num text-text">{res.qty.toPrecision(5)} {res.symbol}</span> at <span className="num text-text">{usd(res.price, res.price < 10 ? 4 : 2)}</span>{" "}
          for <span className="num text-text">{usd(res.usdc)}</span>. Mirrored to {res.mirrored} {res.mirrored === 1 ? "copier" : "copiers"}
          {res.skipped ? `, ${res.skipped} skipped by the risk check` : ""}.{" "}
          <Link href={`/verify/${res.fillId}`} className="text-frost">Signed quote</Link>
        </p>
      ) : null}
      <p className="text-xs text-faint">Paper fill at a live NEAR Intents 1Click quote. Nothing settles and no funds move.</p>
    </form>
  );
}

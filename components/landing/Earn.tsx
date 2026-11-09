"use client";

import { useState } from "react";

/** What a trader keeps: 90% of every pass, paid by the contract at the moment of sale. */
export function Earn() {
  const [price, setPrice] = useState(1.5);
  const [sold, setSold] = useState(25);
  const keep = price * sold * 0.9;
  return (
    <div className="card grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-end">
      <div className="space-y-7">
        <Slider label="Copy pass price" value={`${price.toFixed(1)} NEAR`} min={0.1} max={10} step={0.1} v={price} set={setPrice} />
        <Slider label="Passes sold this month" value={String(sold)} min={1} max={100} step={1} v={sold} set={setSold} />
      </div>
      <div className="md:min-w-[15rem] md:text-right">
        <div className="label">You keep, every 30 days</div>
        <div className="num display mt-2 text-5xl text-amber">{keep.toLocaleString("en-US", { maximumFractionDigits: 1 })}</div>
        <div className="mt-1 text-sm text-mute">NEAR, paid to your wallet on-chain</div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, v, set }: { label: string; value: string; min: number; max: number; step: number; v: number; set: (n: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="text-mute">{label}</span>
        <span className="num font-semibold">{value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} className="mt-3 w-full accent-[#f5b83d]" />
    </label>
  );
}

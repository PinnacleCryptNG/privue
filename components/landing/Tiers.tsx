"use client";

import { IconCopy, IconDelayed, IconRecord, IconView } from "@/components/Icons";
import { near } from "@/lib/format";
import type { Tier } from "@/lib/near";
import { useTraders } from "./useTraders";

const TIERS: { tier: Tier | "public"; name: string; sees: string; body: string; Icon: typeof IconRecord }[] = [
  { tier: "public", name: "Public record", sees: "The numbers", body: "Return, win rate, worst dip and a chart of the account over time. Free for everyone.", Icon: IconRecord },
  { tier: "delayed", name: "Delayed view", sees: "Every trade, 24 hours late", body: "See every trade a day after it happens. Cheaper, good for learning how someone trades.", Icon: IconDelayed },
  { tier: "view", name: "View pass", sees: "Every trade, as it happens", body: "What they bought or sold, how much and at what price, the moment they trade.", Icon: IconView },
  { tier: "copy", name: "Copy pass", sees: "Their trades, placed for you", body: "Each trade is copied into your account at your size. You see your results, not the trades, so nobody can leak them.", Icon: IconCopy },
];

export function Tiers() {
  const list = useTraders();
  const from = (tier: Tier) => {
    const prices = (list ?? []).flatMap((t) => t.offers.filter((o) => o.tier === tier).map((o) => BigInt(o.price)));
    if (!prices.length) return null;
    return near(prices.reduce((a, b) => (b < a ? b : a)).toString());
  };
  return (
    <div className="grid gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {TIERS.map((t, i) => (
        <div key={t.name} data-reveal style={{ transitionDelay: `${i * 70}ms` }} className="flex flex-col bg-panel p-6">
          <t.Icon size={30} className={t.tier === "public" ? "text-mute" : "text-amber"} />
          <h3 className="mt-6 text-lg font-bold tracking-[-0.02em]">{t.name}</h3>
          <p className="mt-1 text-sm font-medium text-amber">{t.sees}</p>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-mute">{t.body}</p>
          <p className="num mt-6 border-t border-line pt-4 text-sm">
            {t.tier === "public" ? "Free" : from(t.tier) ? <>from {from(t.tier)} <span className="text-faint">/ 30 days</span></> : "–"}
          </p>
        </div>
      ))}
    </div>
  );
}

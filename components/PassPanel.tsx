"use client";

import { useState } from "react";
import { near } from "@/lib/format";
import type { Offer } from "@/lib/near";
import { IconCopy, IconDelayed, IconView } from "./Icons";
import { useMe } from "./MeProvider";

const COPY = {
  view: { Icon: IconView, title: "View pass", body: "See every trade the moment it happens." },
  delayed: { Icon: IconDelayed, title: "Delayed view", body: "See every trade 24 hours after it happens." },
  copy: { Icon: IconCopy, title: "Copy pass", body: "Their trades are copied into your practice account at your size. You see your results, not the trades." },
};

export function PassPanel({ offers, owner, held, onBought }: { offers: Offer[]; owner: boolean; held: { view: boolean; delayed: boolean; copy: boolean }; onBought: () => void }) {
  const { me, setSignInOpen, refresh } = useMe();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tier: string; text: string; link?: string; bad?: boolean } | null>(null);

  async function sponsor(o: Offer) {
    setBusy(o.tier);
    setMsg(null);
    try {
      const r = await fetch("/api/passes/sponsor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: o.handle, tier: o.tier }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ tier: o.tier, text: o.tier === "copy" ? "Done. Your copy account is on your desk." : "Done. The trades are now visible on this page.", link: d.explorer });
      await refresh();
      onBought();
    } catch (e) {
      setMsg({ tier: o.tier, text: e instanceof Error ? e.message : "Purchase failed", bad: true });
    } finally {
      setBusy(null);
    }
  }

  async function wallet(o: Offer) {
    if (!me?.session) return;
    setBusy(o.tier);
    setMsg(null);
    try {
      const { buyWithWallet } = await import("@/lib/wallet");
      const tx = await buyWithWallet(o.handle, o.tier, me.session.sub, o.price);
      const r = await fetch("/api/passes/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: o.handle, tier: o.tier, tx }) });
      if (!r.ok) throw new Error((await r.json()).error);
      await refresh();
      onBought();
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (m !== "cancelled") setMsg({ tier: o.tier, text: m || "Wallet purchase failed", bad: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {(["view", "delayed", "copy"] as const).map((tier) => {
        const o = offers.find((x) => x.tier === tier);
        if (!o) return null;
        const left = o.supply - o.sold;
        const { Icon } = COPY[tier];
        return (
          <div key={tier} className="card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="flex items-center gap-2.5 font-bold tracking-[-0.015em]">
                <Icon size={20} className="text-amber" />
                {COPY[tier].title}
              </h3>
              {me?.session?.kind === "near" ? (
                <span className="num font-semibold">{near(o.price)}</span>
              ) : (
                <span className="text-right">
                  <span className="num mr-2 text-sm text-faint line-through">{near(o.price)}</span>
                  <span className="font-semibold text-amber">Free</span>
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-mute">{COPY[tier].body}</p>
            <p className="label mt-2">
              {left} of {o.supply} left · lasts {o.period_days} days
            </p>
            <div className="mt-3">
              {owner ? (
                <p className="text-sm text-mute">This is your profile.</p>
              ) : held[tier] ? (
                <p className="text-sm text-amber">You hold this pass.</p>
              ) : !me?.session ? (
                <button className="btn btn-primary w-full" onClick={() => setSignInOpen(true)}>Get it free</button>
              ) : left <= 0 ? (
                <p className="text-sm text-mute">Sold out.</p>
              ) : me.session.kind === "near" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button className="btn btn-primary" disabled={!!busy} onClick={() => wallet(o)}>{busy === tier ? "Confirm in wallet…" : `Buy for ${near(o.price)}`}</button>
                  <button className="btn btn-ghost" disabled={!!busy} onClick={() => sponsor(o)}>Get it free</button>
                </div>
              ) : (
                <button className="btn btn-primary w-full" disabled={!!busy} onClick={() => sponsor(o)}>
                  {busy === tier ? "Getting your pass…" : "Get it free"}
                </button>
              )}
            </div>
            {msg?.tier === tier ? (
              <p className={`mt-2 text-sm ${msg.bad ? "text-loss" : "text-gain"}`}>
                {msg.text} {msg.link ? <a className="underline" href={msg.link} target="_blank" rel="noreferrer">See it on NEAR</a> : null}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import { near } from "@/lib/format";
import type { Offer } from "@/lib/near";
import { useMe } from "./MeProvider";

const COPY = {
  view: { title: "View pass", body: "See every trade the moment it fills, with its signed quote." },
  delayed: { title: "Delayed view pass", body: "The same trade feed, 24 hours late. Learn the strategy for a fraction of the live price." },
  copy: { title: "Copy pass", body: "Your paper account mirrors each trade at your size. You never see the trades, so the signal can't leak." },
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
      setMsg({ tier: o.tier, text: "Pass minted on NEAR testnet.", link: d.explorer });
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
        return (
          <div key={tier} className="card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">{COPY[tier].title}</h3>
              <span className="num font-medium">{near(o.price)}</span>
            </div>
            <p className="mt-1 text-sm text-mute">{COPY[tier].body}</p>
            <p className="label mt-2">
              {left} of {o.supply} left · {o.period_days} days · paid to the trader on-chain
            </p>
            <div className="mt-3">
              {owner ? (
                <p className="text-sm text-mute">This is your profile.</p>
              ) : held[tier] ? (
                <p className="text-sm text-frost">You hold this pass.</p>
              ) : !me?.session ? (
                <button className="btn btn-primary w-full" onClick={() => setSignInOpen(true)}>Sign in to get it</button>
              ) : left <= 0 ? (
                <p className="text-sm text-mute">Sold out.</p>
              ) : me.session.kind === "near" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button className="btn btn-primary" disabled={!!busy} onClick={() => wallet(o)}>{busy === tier ? "Confirm in wallet…" : `Buy for ${near(o.price)}`}</button>
                  <button className="btn btn-ghost" disabled={!!busy} onClick={() => sponsor(o)}>Use a free demo pass</button>
                </div>
              ) : (
                <button className="btn btn-primary w-full" disabled={!!busy} onClick={() => sponsor(o)}>
                  {busy === tier ? "Minting on testnet…" : "Get a free demo pass"}
                </button>
              )}
            </div>
            {msg?.tier === tier ? (
              <p className={`mt-2 text-sm ${msg.bad ? "text-loss" : "text-gain"}`}>
                {msg.text} {msg.link ? <a className="underline" href={msg.link} target="_blank" rel="noreferrer">View transaction</a> : null}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

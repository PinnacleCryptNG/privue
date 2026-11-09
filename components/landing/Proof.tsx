"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconChain, IconEnclave, IconSigned } from "@/components/Icons";
import { ago } from "@/lib/format";
import { useRecord, useTraders } from "./useTraders";

type Detail = { latestFill: number | null; signedFills: number; note: { model: string; created_at: string } | null };

/** Three claims, each with a live link to check it. */
export function Proof() {
  const list = useTraders();
  const top = list?.[0];
  const rec = useRecord(top?.handle);
  const [d, setD] = useState<Detail | null>(null);
  const [noted, setNoted] = useState<{ handle: string; model: string; at: string } | null>(null);
  useEffect(() => {
    if (!list?.length) return;
    Promise.all(list.map((t) => fetch(`/api/traders/${t.handle}`).then((r) => r.json()).then((x: Detail) => ({ t, x }))))
      .then((all) => {
        setD(all[0]?.x ?? null);
        const n = all.find((a) => a.x.note);
        if (n?.x.note) setNoted({ handle: n.t.handle, model: n.x.note.model, at: n.x.note.created_at });
      })
      .catch(() => undefined);
  }, [list]);

  const items = [
    {
      Icon: IconSigned,
      h: "Every price is signed",
      p: "Each fill is priced from a live NEAR Intents 1Click quote, and the quote's ed25519 signature is stored with it. Anyone can re-check it without seeing the trade.",
      cta: d?.latestFill ? { href: `/verify/${d.latestFill}`, label: `Check fill #${d.latestFill}` } : null,
    },
    {
      Icon: IconChain,
      h: "The record can't be trimmed",
      p: "Fills are sealed with AES-256-GCM and linked in a SHA-256 chain. The chain's head is written to the passes contract on NEAR, which only accepts a longer chain. Drop a losing trade and every later hash breaks.",
      cta: top ? { href: `/verify/record/${top.handle}`, label: rec ? `@${top.handle}: ${rec.fills} fills, ${rec.checkpoints.length} on-chain ${rec.checkpoints.length === 1 ? "checkpoint" : "checkpoints"}` : `Check @${top.handle}'s record` } : null,
    },
    {
      Icon: IconEnclave,
      h: "Notes from a sealed model",
      p: "Strategy notes are written by NEAR AI Cloud models inside a TEE, from aggregate statistics only. Privue verifies the enclave first, and a second model rejects any draft that hints at a position.",
      cta: noted ? { href: `/t/${noted.handle}`, label: `Latest note: @${noted.handle}, ${ago(noted.at)}` } : null,
    },
  ];
  return (
    <div className="grid gap-10 md:grid-cols-3 md:gap-8">
      {items.map((it, i) => (
        <div key={it.h} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
          <it.Icon size={28} className="text-amber" />
          <h3 className="mt-5 text-xl font-bold tracking-[-0.025em]">{it.h}</h3>
          <p className="mt-2.5 leading-relaxed text-mute">{it.p}</p>
          {it.cta ? (
            <Link href={it.cta.href} className="link mt-4 inline-block text-sm font-medium">
              {it.cta.label}
            </Link>
          ) : (
            <span className="mt-4 inline-block h-5" />
          )}
        </div>
      ))}
    </div>
  );
}

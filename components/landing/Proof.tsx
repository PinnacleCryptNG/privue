"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconChain, IconEnclave, IconSigned } from "@/components/Icons";
import { ago } from "@/lib/format";
import { useTraders } from "./useTraders";

type Detail = { latestFill: number | null; signedFills: number; note: { model: string; created_at: string } | null };

/** Three claims, each with a live link to check it. */
export function Proof() {
  const list = useTraders();
  const top = list?.[0];
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
      h: "Real prices, signed",
      p: "Every trade is priced from a live NEAR Intents quote that comes with a digital signature. Anyone can check the signature without seeing the trade.",
      cta: d?.latestFill ? { href: `/verify/${d.latestFill}`, label: "Check a signed trade" } : null,
    },
    {
      Icon: IconChain,
      h: "No hiding losing trades",
      p: "Each trade is encrypted and linked to the one before it, and a fingerprint of the whole list is saved on NEAR. If a trade were removed, the fingerprint would stop matching.",
      cta: top ? { href: `/verify/record/${top.handle}`, label: `Check ${top.name}'s record` } : null,
    },
    {
      Icon: IconEnclave,
      h: "AI notes that can't leak",
      p: "Strategy summaries are written by NEAR AI inside sealed hardware, from overall statistics only. A second model rejects any summary that hints at a specific trade.",
      cta: noted ? { href: `/t/${noted.handle}`, label: `Read the latest note (${ago(noted.at)})` } : null,
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

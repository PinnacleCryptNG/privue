"use client";

import Link from "next/link";
import { useMe } from "./MeProvider";

/** Three steps that walk a first-time visitor through the whole product. Hidden once all are done. */
export function GuestGuide({ always = false }: { always?: boolean }) {
  const { me, setSignInOpen } = useMe();
  const signedIn = !!me?.session;
  const steps = [
    {
      done: signedIn,
      h: "Start a free account",
      p: "No wallet or money needed. You get a guest account straight away.",
      cta: signedIn ? null : { label: "Start free", onClick: () => setSignInOpen(true) },
    },
    {
      done: !!me?.passes.some((p) => p.tier !== "copy"),
      h: "Watch a trader",
      p: "Open a trader and get a free View pass. Their hidden trades appear on the page.",
      cta: { label: "Pick a trader", href: "/traders" },
    },
    {
      done: !!me?.copies.length,
      h: "Copy one blind",
      p: "Get a free Copy pass. Their trades are placed in your own practice account, but you never see them.",
      cta: { label: "Pick a trader", href: "/traders" },
    },
  ];
  const next = steps.findIndex((s) => !s.done);
  if (next === -1 && !always) return null;
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold tracking-[-0.02em]">{next === -1 ? "You've tried everything" : "Try Privue in three steps"}</h2>
        <span className="label">Free · NEAR testnet · practice money only</span>
      </div>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.h} className={`rounded-[10px] border p-4 ${i === next ? "border-amber/60 bg-amber/[0.06]" : "border-line"}`}>
            <div className="flex items-center gap-2.5">
              <span
                className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-gain text-ink" : i === next ? "bg-amber text-ink" : "bg-raise text-mute"}`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <h3 className={`font-semibold ${s.done ? "text-mute" : ""}`}>{s.h}</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-mute">{s.p}</p>
            {i === next && s.cta ? (
              "href" in s.cta && s.cta.href ? (
                <Link href={s.cta.href} className="btn btn-primary mt-3 h-9 px-4 text-sm">
                  {s.cta.label}
                </Link>
              ) : (
                <button className="btn btn-primary mt-3 h-9 px-4 text-sm" onClick={"onClick" in s.cta ? s.cta.onClick : undefined}>
                  {s.cta.label}
                </button>
              )
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

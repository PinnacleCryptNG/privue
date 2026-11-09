"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreateTrader } from "@/components/CreateTrader";
import { GuestGuide } from "@/components/GuestGuide";
import { shortId, useMe } from "@/components/MeProvider";
import { NoteButton } from "@/components/NoteButton";
import { TradeTicket } from "@/components/TradeTicket";
import { pct, tone, usd } from "@/lib/format";

export default function MePage() {
  const { me, loading, refresh, setSignInOpen } = useMe();
  const router = useRouter();
  if (loading) return <div className="mx-auto max-w-6xl px-5 py-24 text-mute">Loading…</div>;
  if (!me?.session)
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="display text-4xl">Your desk</h1>
        <p className="mt-3 text-mute">Your passes, the traders you copy and your own trading live here. Start free, no wallet needed.</p>
        <button className="btn btn-primary mt-6 h-12 px-6" onClick={() => setSignInOpen(true)}>Start free</button>
      </div>
    );

  const handle = me.traders[0];
  const views = me.passes.filter((p) => p.tier !== "copy");

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    const { walletSignOut } = await import("@/lib/wallet");
    await walletSignOut();
    await refresh();
    router.push("/");
  }

  async function signOutEverywhere() {
    const r = await fetch("/api/auth/sessions", { method: "DELETE" }).then((x) => x.json());
    alert(`Signed out on ${r.revoked ?? 0} other ${r.revoked === 1 ? "device" : "devices"}.`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">Your desk</h1>
          <p className="mt-2 text-mute">
            {me.session.kind === "guest" ? (
              <>
                Free guest account <span className="num">{shortId(me.session.sub)}</span>.{" "}
                <button className="link" onClick={() => setSignInOpen(true)}>Connect a wallet</button> to keep it.
              </>
            ) : (
              <>
                NEAR testnet wallet <span className="num">{me.session.sub}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost h-10 text-sm" onClick={signOutEverywhere}>Sign out other devices</button>
          <button className="btn btn-ghost h-10 text-sm" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <GuestGuide />

      <section className="space-y-3">
        <h2 className="text-xl font-bold tracking-[-0.02em]">Copying</h2>
        {me.copies.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {me.copies.map((c) => (
              <div key={c.handle} className="card p-5">
                <div className="flex items-baseline justify-between">
                  <Link href={`/t/${c.handle}`} className="font-semibold hover:text-amber">@{c.handle}</Link>
                  <span className={`num text-lg font-semibold ${tone(c.stats.pnl)}`}>{pct(c.stats.pnlPct)}</span>
                </div>
                <p className="mt-1 text-sm text-mute">
                  <span className="num">{usd(c.stats.equity)}</span> of {usd(c.stats.startCash, 0)} · {c.stats.totalFills} mirrored{" "}
                  {c.stats.totalFills === 1 ? "trade" : "trades"} copied · {pct(c.stats.exposure, 0, false)} invested
                </p>
                <p className="label mt-3">Your practice account copies their trades. The trades themselves stay hidden.</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-mute">Not copying anyone yet. <Link className="text-amber" href="/traders">Pick a trader</Link> and get a Copy pass.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold tracking-[-0.02em]">Watching</h2>
        {views.length ? (
          <ul className="card divide-y divide-line">
            {views.map((p) => (
              <li key={p.handle} className="flex items-center justify-between px-4 py-3 text-sm">
                <Link href={`/t/${p.handle}`} className="font-medium hover:text-amber">
                  @{p.handle}
                  {p.tier === "delayed" ? <span className="ml-2 text-xs text-mute">24h delay</span> : null}
                </Link>
                <span className="text-mute">until {new Date(p.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mute">Not watching anyone yet. A View pass shows a trader&apos;s trades.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold tracking-[-0.02em]">Trade yourself</h2>
          {handle ? <Link href={`/t/${handle}`} className="text-sm text-amber">Public profile</Link> : null}
        </div>
        {handle ? (
          <div className="grid items-start gap-4 md:grid-cols-2">
            <TradeTicket handle={handle} onFilled={refresh} />
            <NoteButton handle={handle} />
          </div>
        ) : (
          <>
            <p className="max-w-xl text-sm text-mute">Optional. Open your own trader profile, place practice trades at real prices and sell passes to followers. Your trades stay private.</p>
            <CreateTrader onCreated={refresh} />
          </>
        )}
      </section>
    </div>
  );
}

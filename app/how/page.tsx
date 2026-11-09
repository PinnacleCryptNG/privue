import type { Metadata } from "next";
import Link from "next/link";
import { Blinds } from "@/components/Blinds";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    h: "Trades stay private",
    p: "Traders place orders on their Privue desk. Each one is priced by a live NEAR Intents 1Click quote, signed by 1Click. On mainnet the same order would settle through Confidential Intents, so it never appears on a public explorer.",
  },
  {
    h: "The track record is public",
    p: "Return, win rate, drawdown and an hourly equity curve are computed from the signed fills. Anyone can re-check the signature on any fill without learning what was traded.",
  },
  {
    h: "The record can't be edited",
    p: "Every fill is sealed (AES-256-GCM) before it reaches the database and linked into a SHA-256 hash chain. The chain's head is anchored on NEAR. Dropping or changing a losing trade changes every later hash, and the public record check shows the mismatch.",
  },
  {
    h: "Passes are scarce and on-chain",
    p: "Each trader sells a fixed number of passes through the Privue contract on NEAR. The trader gets 90% of every sale, Privue keeps 10%. Passes run for 30 days.",
  },
  {
    h: "Watch, wait, or copy blind",
    p: "A view pass shows every trade the moment it fills; a delayed view pass shows them 24 hours later, for less. A copy pass mirrors each trade into your own account, sized to your balance, and never shows it to you. The signal can't be leaked or front-run, so traders can sell more of them.",
  },
  {
    h: "A risk check before every copy",
    p: "Each mirrored order is checked against your account first. Copies under $5, or that would put more than 60% of the account into one asset, are skipped and logged.",
  },
  {
    h: "Notes without positions",
    p: "NEAR AI Cloud models run inside a TEE and write a short weekly strategy note from the trader's fills. The note describes the approach without naming positions, and Privue checks the model's attestation. A second NEAR AI model reviews every draft, and any hint of a position discards it.",
  },
];

export default function How() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <h1 className="display text-5xl sm:text-6xl">How Privue works.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-mute">
            Copy trading usually means showing everyone your trades. On Privue the record is public and the trades sit behind the blinds. Traders
            choose who looks through, and how.
          </p>
        </div>
        <div className="card hidden overflow-hidden lg:block">
          <Blinds count={4} slat={40} offsetMs={400} />
        </div>
      </div>
      <ol className="mt-16 grid gap-px overflow-hidden rounded-[14px] border border-line bg-line md:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.h} className="bg-panel p-6 sm:p-8">
            <span className="num text-sm font-semibold text-amber">{String(i + 1).padStart(2, "0")}</span>
            <h2 className="mt-3 text-xl font-bold tracking-[-0.025em]">{s.h}</h2>
            <p className="mt-2 leading-relaxed text-mute">{s.p}</p>
          </li>
        ))}
        <li className="slatlines bg-panel p-6 sm:p-8">
          <span className="num text-sm font-semibold text-amber">Testnet</span>
          <h2 className="mt-3 text-xl font-bold tracking-[-0.025em]">What&apos;s real today</h2>
          <p className="mt-2 leading-relaxed text-mute">
            Prices are real: live, signed 1Click quotes from NEAR Intents mainnet. Fills are paper fills, so no money moves. Passes, payouts and
            record checkpoints are real transactions on NEAR testnet. Settling trades through Confidential Intents needs partner access and
            mainnet.
          </p>
        </li>
      </ol>
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/traders" className="btn btn-primary h-12 px-6">See the traders</Link>
        <Link href="/me" className="btn btn-ghost h-12 px-6">Open your desk</Link>
      </div>
    </div>
  );
}

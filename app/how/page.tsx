import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    h: "Trades stay private",
    p: "Traders place orders through Privue. Each one is priced by a live NEAR Intents 1Click quote, which comes back signed by 1Click. On mainnet the same order settles through Confidential Intents, so it never shows up on a public explorer.",
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
    h: "View, or copy blind",
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
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">How Privue works</h1>
      <p className="mt-3 text-mute">
        Copy trading usually means showing everyone your trades. On Privue the track record is public and the trades are private. Traders choose
        who sees them.
      </p>
      <ol className="mt-10 space-y-8">
        {STEPS.map((s, i) => (
          <li key={s.h} className="grid gap-3 sm:grid-cols-[3rem_1fr]">
            <span className="num text-sm text-frost">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="font-semibold">{s.h}</h2>
              <p className="mt-1.5 leading-relaxed text-mute">{s.p}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="card mt-12 p-5 text-sm leading-relaxed text-mute">
        <h2 className="mb-2 font-semibold text-text">What&apos;s real during the hackathon</h2>
        <p>
          The prices are real: live, signed 1Click quotes on NEAR Intents mainnet. The fills are paper fills, so no money moves. Passes are real
          transactions on NEAR testnet. Confidential settlement through Confidential Intents needs partner access, which is invite-only.
        </p>
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/traders" className="btn btn-primary">See the traders</Link>
        <Link href="/me" className="btn btn-ghost">Start trading</Link>
      </div>
    </div>
  );
}

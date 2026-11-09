import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-5 py-12 leading-relaxed text-mute">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-text">Privacy</h1>
      <p className="label">Testnet demonstration · last updated November 2026</p>
      <h2 className="font-semibold text-text">What we store</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your account ID: a random guest ID, or the NEAR testnet account you sign in with.</li>
        <li>Session records (when created and last used) so you can sign out other devices.</li>
        <li>Passes you hold, read from the NEAR testnet contract.</li>
        <li>If you trade: your paper fills, each sealed with AES-256-GCM before it is written to the database, plus their hash-chain fingerprints.</li>
        <li>Short-lived counters keyed by IP address for rate limiting, deleted after two days.</li>
      </ul>
      <h2 className="font-semibold text-text">What is public</h2>
      <p>
        Aggregate statistics for traders (return, win rate, drawdown, an hourly equity curve), fill counts and hash-chain fingerprints. Pass purchases,
        transfers and record checkpoints are NEAR testnet transactions and are public on the chain. Individual trades are shown only to the trader and
        to View pass holders; copy pass holders never see them.
      </p>
      <h2 className="font-semibold text-text">AI strategy notes</h2>
      <p>
        Notes are written by models on NEAR AI Cloud running in a verified TEE. The model receives only aggregate behaviour (trade counts, sizes as a share
        of the account, holding times, win rate), never assets, prices or times.
      </p>
      <h2 className="font-semibold text-text">Who processes data</h2>
      <p>
        Vercel (hosting and logs), Neon (database), NEAR testnet RPC providers, NEAR Intents 1Click (price quotes, which contain no personal data) and NEAR
        AI Cloud (notes). Logs are structured and redact trade details and credentials. We don&apos;t sell data or use tracking cookies; the only cookies
        are your sign-in session and a short-lived sign-in challenge.
      </p>
      <h2 className="font-semibold text-text">Your choices</h2>
      <p>
        You can sign out, or sign out every other device, from Your passes. To have your account data deleted, open an issue at github.com/PinnacleCryptNG/privue.
        Data written to NEAR testnet can&apos;t be deleted by us.
      </p>
    </div>
  );
}

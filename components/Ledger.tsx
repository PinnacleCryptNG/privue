import Link from "next/link";
import { usd } from "@/lib/format";

export type FeedFill = { id: number; side: "buy" | "sell"; symbol: string; qty: number; usdc: number; price: number; createdAt: string };

const GHOST = ["NEAR", "ETH", "SOL", "BTC", "ZEC"];

/** Locked view: one frosted row per real fill, carrying no trade data, only its proof link. */
export function LockedLedger({ count, latest }: { count: number; latest: number | null }) {
  const rows = Math.min(Math.max(count, 3), 7);
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-line">
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-4 py-3 text-sm">
            <span className="frosted text-gain">{i % 3 ? "BUY" : "SELL"}</span>
            <span className="frosted">{GHOST[(i * 7 + count) % GHOST.length]} · 0.{(i * 3917) % 9000}</span>
            <span className="frosted num">$1,{(i * 271) % 900}.00</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-b from-ink/30 via-ink/70 to-ink/90 px-6 text-center">
        <p className="font-medium">{count} private {count === 1 ? "fill" : "fills"}</p>
        <p className="max-w-xs text-sm text-mute">Hidden until you hold a view pass. Every one carries a signed 1Click quote.</p>
        {latest ? (
          <Link href={`/verify/${latest}`} className="mt-1 text-sm text-frost hover:underline">
            Check the latest fill&apos;s signature
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function OpenLedger({ fills }: { fills: FeedFill[] }) {
  if (!fills.length) return <p className="card px-4 py-6 text-sm text-mute">No fills yet. New trades show up here the moment they fill.</p>;
  return (
    <div className="card divide-y divide-line">
      {fills.map((f) => (
        <div key={f.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-4 py-3 text-sm">
          <span className={f.side === "buy" ? "font-medium text-gain" : "font-medium text-loss"}>{f.side.toUpperCase()}</span>
          <span className="min-w-0">
            <span className="font-medium">{f.symbol}</span>
            <span className="num text-mute"> · {f.qty.toPrecision(5)} @ {usd(f.price, f.price < 10 ? 4 : 2)}</span>
            <span className="block text-xs text-faint">
              {new Date(f.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} ·{" "}
              <Link href={`/verify/${f.id}`} className="hover:text-frost">signed quote</Link>
            </span>
          </span>
          <span className="num">{usd(f.usdc)}</span>
        </div>
      ))}
    </div>
  );
}

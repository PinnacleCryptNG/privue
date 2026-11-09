import Link from "next/link";
import { usd } from "@/lib/format";
import { Blinds } from "./Blinds";

export type FeedFill = { id: number; side: "buy" | "sell"; symbol: string; qty: number; usdc: number; price: number; createdAt: string };

/** Locked view: the blinds stay down. One slat per real fill, carrying nothing but its number. */
export function LockedLedger({ count, latest }: { count: number; latest: number | null }) {
  const slats = Math.min(Math.max(count, 4), 8);
  return (
    <div className="relative overflow-hidden rounded-[12px] border border-line">
      <Blinds
        count={slats}
        slat={46}
        still
      />
      <div className="absolute inset-x-0 top-0 flex items-center justify-center" style={{ height: slats * 46 }}>
        <div className="rounded-[10px] border border-line bg-ink/95 px-5 py-3 text-center shadow-xl">
          <p className="font-bold tracking-[-0.02em]">
            {count} {count === 1 ? "trade" : "trades"} hidden
          </p>
          <p className="text-sm text-mute">Get a View pass to see them.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-panel px-4 py-3 text-sm">
        <span className="text-mute">Each trade is priced by a signed NEAR Intents quote.</span>
        {latest ? <Link href={`/verify/${latest}`} className="link font-medium">Check a signature</Link> : null}
      </div>
    </div>
  );
}

export function OpenLedger({ fills }: { fills: FeedFill[] }) {
  if (!fills.length) return <p className="card px-4 py-6 text-sm text-mute">No trades yet. New trades show up here the moment they happen.</p>;
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
              <Link href={`/verify/${f.id}`} className="hover:text-amber">signed quote</Link>
            </span>
          </span>
          <span className="num">{usd(f.usdc)}</span>
        </div>
      ))}
    </div>
  );
}

import { q } from "./db";
import { accountStats, equitySeries, symbolPrices, traderAccount, type Trader } from "./engine";
import { listOffers, type Offer } from "./near";
import type { PublicStats } from "./stats";

export type PublicTrader = {
  handle: string;
  name: string;
  bio: string;
  style: string;
  markets: string[];
  isBot: boolean;
  createdAt: string;
  stats: PublicStats;
  offers: Offer[];
  copiers: number;
};

export async function publicTrader(t: Trader, prices: Record<string, number>, offers: Offer[]): Promise<PublicTrader> {
  const [stats, copiers] = await Promise.all([
    accountStats(traderAccount(t.handle), Number(t.start_cash), prices),
    q<{ n: number }>("select count(*)::int as n from passes where handle = $1 and tier = 'copy' and expires_at > now()", [t.handle]),
  ]);
  return {
    handle: t.handle,
    name: t.name,
    bio: t.bio,
    style: t.style,
    markets: t.markets,
    isBot: t.is_bot,
    createdAt: new Date(t.created_at).toISOString(),
    stats,
    offers: offers.filter((o) => o.handle === t.handle),
    copiers: copiers[0]?.n ?? 0,
  };
}

export async function publicContext() {
  const [prices, offers] = await Promise.all([symbolPrices(), listOffers().catch(() => [] as Offer[])]);
  return { prices, offers };
}

/** Equity curve bucketed hourly so trade timing can't be read off the chart. */
export async function publicCurve(handle: string): Promise<{ ts: string; value: number }[]> {
  const series = await equitySeries(traderAccount(handle), 2000);
  const buckets = new Map<string, number>();
  for (const p of series) buckets.set(p.ts.slice(0, 13) + ":00:00.000Z", p.value);
  return [...buckets].map(([ts, value]) => ({ ts, value }));
}

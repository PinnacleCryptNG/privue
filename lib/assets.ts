export type Asset = {
  symbol: string;
  name: string;
  assetId: string;
  decimals: number;
};

export const USDC: Asset = {
  symbol: "USDC",
  name: "USD Coin",
  assetId: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  decimals: 6,
};

export const MARKETS: Asset[] = [
  { symbol: "NEAR", name: "NEAR", assetId: "nep141:wrap.near", decimals: 24 },
  { symbol: "BTC", name: "Bitcoin", assetId: "nep141:nbtc.bridge.near", decimals: 8 },
  { symbol: "ETH", name: "Ether", assetId: "nep141:eth.omft.near", decimals: 18 },
  { symbol: "SOL", name: "Solana", assetId: "nep141:sol.omft.near", decimals: 9 },
  { symbol: "ZEC", name: "Zcash", assetId: "nep141:zec.omft.near", decimals: 8 },
];

export function market(symbol: string): Asset {
  const a = MARKETS.find((m) => m.symbol === symbol);
  if (!a) throw new Error(`unknown market ${symbol}`);
  return a;
}

export function toUnits(amount: number, decimals: number): string {
  const places = Math.min(decimals, 12);
  const truncated = Math.floor(amount * 10 ** places) / 10 ** places;
  const [whole, frac = ""] = truncated.toFixed(places).split(".");
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0")).toString();
}

export function fromUnits(units: string, decimals: number): number {
  const v = BigInt(units);
  const base = 10n ** BigInt(decimals);
  return Number(v / base) + Number(v % base) / Number(base);
}

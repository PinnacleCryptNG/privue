export const usd = (v: number, digits = 2) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (v: number, digits = 2, signed = true) => `${signed && v > 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;

export const signedUsd = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${usd(Math.abs(v))}`;

export const near = (yocto: string) => {
  const n = Number(BigInt(yocto) / 10n ** 18n) / 1e6;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 3 })} NEAR`;
};

export function ago(iso: string | null): string {
  if (!iso) return "no trades yet";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export const tone = (v: number) => (v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-mute");

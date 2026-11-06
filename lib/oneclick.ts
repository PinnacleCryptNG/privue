import { verifyQuoteSignature } from "@defuse-protocol/one-click-sdk-typescript";
import { type Asset, fromUnits, toUnits, USDC } from "./assets";

const BASE = process.env.ONECLICK_BASE_URL ?? "https://1click.chaindefuser.com";
const PAPER_ACCOUNT = "privue.near";

export type SignedQuote = {
  correlationId?: string;
  timestamp: string;
  signature: string;
  quoteRequest: Record<string, unknown>;
  quote: {
    amountIn: string;
    amountInFormatted: string;
    amountInUsd?: string;
    amountOut: string;
    amountOutFormatted: string;
    amountOutUsd?: string;
    timeEstimate?: number;
    [k: string]: unknown;
  };
};

export type PaperFill = {
  side: "buy" | "sell";
  asset: Asset;
  qty: number;
  usdc: number;
  price: number;
  quote: SignedQuote;
};

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.ONECLICK_JWT) h.Authorization = `Bearer ${process.env.ONECLICK_JWT}`;
  return h;
}

export async function dryQuote(from: Asset, to: Asset, amountIn: number): Promise<SignedQuote> {
  const body = {
    dry: true,
    swapType: "EXACT_INPUT",
    slippageTolerance: 50,
    originAsset: from.assetId,
    depositType: "INTENTS",
    destinationAsset: to.assetId,
    amount: toUnits(amountIn, from.decimals),
    recipient: PAPER_ACCOUNT,
    recipientType: "INTENTS",
    refundTo: PAPER_ACCOUNT,
    refundType: "INTENTS",
    deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
    referral: "privue",
  };
  const res = await fetch(`${BASE}/v0/quote`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`1Click quote failed (${res.status}): ${json?.message ?? "unknown error"}`);
  if (!verifyQuote(json)) throw new Error("1Click quote signature did not verify");
  return json as SignedQuote;
}

export function verifyQuote(q: unknown): boolean {
  try {
    return verifyQuoteSignature(q as Parameters<typeof verifyQuoteSignature>[0]);
  } catch {
    return false;
  }
}

export async function paperBuy(asset: Asset, usdc: number): Promise<PaperFill> {
  const quote = await dryQuote(USDC, asset, usdc);
  const qty = fromUnits(quote.quote.amountOut, asset.decimals);
  const spent = fromUnits(quote.quote.amountIn, USDC.decimals);
  return { side: "buy", asset, qty, usdc: spent, price: spent / qty, quote };
}

export async function paperSell(asset: Asset, qty: number): Promise<PaperFill> {
  const quote = await dryQuote(asset, USDC, qty);
  const sold = fromUnits(quote.quote.amountIn, asset.decimals);
  const got = fromUnits(quote.quote.amountOut, USDC.decimals);
  return { side: "sell", asset, qty: sold, usdc: got, price: got / sold, quote };
}

export async function tokenPrices(): Promise<Record<string, number>> {
  const res = await fetch(`${BASE}/v0/tokens`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`1Click tokens failed (${res.status})`);
  const list = (await res.json()) as { assetId: string; price: number }[];
  return Object.fromEntries(list.map((t) => [t.assetId, Number(t.price)]));
}

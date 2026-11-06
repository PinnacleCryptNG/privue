import { MARKETS } from "./assets";
import { q } from "./db";
import { accountFills, getTrader, traderAccount } from "./engine";
import { assertAttestationOrThrow } from "./near-ai/attestation";
import { chatCompletion, fetchSignature, resolveModel, verifySignature, type SignatureVerification } from "./near-ai/chat";
import type { Fill } from "./stats";

export const MIN_FILLS_FOR_NOTE = 3;
export const NOTE_EVERY_DAYS = 7;

export const notesEnabled = () => Boolean(process.env.NEARAI_API_KEY?.trim() || process.env.NEARAI_CLOUD_API_KEY?.trim());

export class NoteError extends Error {}

/** Position-agnostic behaviour: the only thing the model ever sees. No symbols, prices or timestamps. */
export type Behaviour = {
  trades: number;
  buys: number;
  sells: number;
  closedTrades: number;
  winRatePct: number | null;
  avgHoldHours: number | null;
  avgBuyPctOfStart: number;
  largestBuyPctOfStart: number;
  marketsTraded: number;
  activeDays: number;
  tradesPerActiveDay: number;
};

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function behaviour(fills: Fill[], startCash: number): Behaviour {
  const open: Record<string, { qty: number; cost: number; since: number }> = {};
  let closed = 0;
  let wins = 0;
  let holdMs = 0;
  for (const f of fills) {
    const t = Date.parse(f.createdAt);
    const p = (open[f.symbol] ??= { qty: 0, cost: 0, since: t });
    if (f.side === "buy") {
      if (p.qty <= 0) p.since = t;
      p.qty += f.qty;
      p.cost += f.usdc;
    } else if (p.qty > 0) {
      const share = Math.min(1, f.qty / p.qty);
      const basis = p.cost * share;
      closed += 1;
      if (f.usdc > basis) wins += 1;
      holdMs += t - p.since;
      p.qty -= f.qty;
      p.cost -= basis;
      if (p.qty <= 1e-12) Object.assign(p, { qty: 0, cost: 0 });
    }
  }
  const buys = fills.filter((f) => f.side === "buy");
  const days = new Set(fills.map((f) => f.createdAt.slice(0, 10))).size;
  const buyPct = buys.map((b) => (b.usdc / startCash) * 100);
  return {
    trades: fills.length,
    buys: buys.length,
    sells: fills.length - buys.length,
    closedTrades: closed,
    winRatePct: closed ? round((wins / closed) * 100, 0) : null,
    avgHoldHours: closed ? round(holdMs / closed / 3.6e6) : null,
    avgBuyPctOfStart: buyPct.length ? round(buyPct.reduce((a, b) => a + b, 0) / buyPct.length) : 0,
    largestBuyPctOfStart: buyPct.length ? round(Math.max(...buyPct)) : 0,
    marketsTraded: new Set(fills.map((f) => f.symbol)).size,
    activeDays: days,
    tradesPerActiveDay: days ? round(fills.length / days) : 0,
  };
}

const SYMBOLS = [...MARKETS.map((m) => m.symbol), "USDC", "USDT", "WBTC", "WETH", "WNEAR"];
const NAMES = ["bitcoin", "ethereum", "ether", "solana", "zcash", "tether", "near protocol"];

/** Anything that names or prices a position. A note with any leak is discarded, never shown. */
export function findLeaks(text: string): string[] {
  const leaks = SYMBOLS.filter((s) => new RegExp(`\\b${s}\\b`).test(text));
  leaks.push(...NAMES.filter((n) => new RegExp(`\\b${n}\\b`, "i").test(text)));
  if (/\$\s?\d/.test(text)) leaks.push("price");
  return leaks;
}

export const cleanNote = (s: string) =>
  s
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/[*#`_]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, 900);

const SYSTEM = `You write the strategy note on a trader's profile in a private copy-trading marketplace.
You get the trader's style label and behaviour statistics. In 3 or 4 plain sentences, describe how they trade: cadence, sizing, holding time, how they handle losers, and what kind of follower suits them.
Never name or hint at any asset, token, ticker, chain, sector or price level, even if you could guess it. Don't give advice or predictions. No lists, headings or markdown.`;

export type NoteProof = {
  chatId: string;
  attestation: { verifiedAt: string; nonce: string; gatewaySigner: string; modelSigners: string[]; tcb: string[]; gpu: string[] };
  signature: SignatureVerification;
  inputs: Behaviour;
};

export async function generateNote(handle: string) {
  const trader = await getTrader(handle);
  if (!trader) throw new NoteError("unknown trader");
  const fills = await accountFills(traderAccount(handle));
  if (fills.length < MIN_FILLS_FOR_NOTE) throw new NoteError(`a note needs at least ${MIN_FILLS_FOR_NOTE} trades`);
  const inputs = behaviour(fills, trader.start_cash);
  const model = resolveModel();
  const attestation = await assertAttestationOrThrow(model);
  const messages = [
    { role: "system" as const, content: SYSTEM },
    { role: "user" as const, content: JSON.stringify({ style: trader.style, ...inputs }) },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const c = await chatCompletion(model, messages, 400);
    const body = cleanNote(c.content);
    if (body.length < 40 || findLeaks(body).length) continue;
    const signature = verifySignature(await fetchSignature(c.chatId, model), c, model, attestation);
    const proof: NoteProof = {
      chatId: c.chatId,
      attestation: {
        verifiedAt: attestation.verifiedAt,
        nonce: attestation.nonce,
        gatewaySigner: attestation.gateway.signingAddress,
        modelSigners: attestation.models.map((m) => m.signingAddress),
        tcb: attestation.models.map((m) => m.tcbStatus),
        gpu: attestation.models.map((m) => (m.gpu === "not_present" ? "not_present" : "verified")),
      },
      signature,
      inputs,
    };
    const [row] = await q<{ id: number }>("insert into notes (handle, body, model, proof) values ($1, $2, $3, $4) returning id", [
      handle,
      body,
      model,
      JSON.stringify(proof),
    ]);
    return { id: row.id, body, model, proof };
  }
  throw new NoteError("the model's draft named a position, so it was discarded");
}

/** Bots get a fresh note when they have enough trades and the last one is a week old. One per tick. */
export async function dueNote(handles: string[]): Promise<string | null> {
  for (const handle of handles) {
    const [r] = await q<{ n: number; last: string | null }>(
      `select (select count(*)::int from fills where account = $1) as n,
              (select max(created_at) from notes where handle = $2) as last`,
      [traderAccount(handle), handle],
    );
    if (r.n >= MIN_FILLS_FOR_NOTE && (!r.last || Date.now() - Date.parse(r.last) > NOTE_EVERY_DAYS * 864e5)) return handle;
  }
  return null;
}

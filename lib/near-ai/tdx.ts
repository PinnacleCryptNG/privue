// Server-only Intel TDX / dstack measurement checks for NEAR AI Cloud reports.
// Ported from https://github.com/nearai/nearai-cloud-verifier (ts/model_verifier.ts, Apache-2.0)
// and the rules in https://docs.near.ai/cloud/verification/reference/quote-nonce-signer
import { createHash } from "node:crypto";

export const INTEL_PCCS_URL = "https://api.trustedservices.intel.com/tdx/certification/v4";

/** Fields read from a dcap-qvl verified TD10 report (all hex). */
export type VerifiedQuote = {
  status: string;
  advisoryIds: string[];
  tdAttributes: string;
  reportData: string;
  mrConfigId: string;
  rtMr3: string;
};

export type QuoteVerifier = (quoteHex: string) => Promise<VerifiedQuote>;

const DSTACK_RUNTIME_EVENT_TYPE = 0x08000001;
const HEX = /^[0-9a-fA-F]*$/;

export function hexToBuffer(value: unknown, label: string): Buffer {
  if (typeof value !== "string") throw new Error(`${label}: not a string`);
  const hex = value.replace(/^0x/i, "");
  if (hex.length % 2 !== 0 || !HEX.test(hex)) throw new Error(`${label}: invalid hex`);
  return Buffer.from(hex, "hex");
}

/**
 * Verify an Intel TDX quote with dcap-qvl (collateral from Intel PCS), as in
 * nearai-cloud-verifier `checkTdxQuote`. Throws on any verifier error.
 */
export async function verifyQuoteWithDcap(
  quoteHex: string,
  { pccsUrl = INTEL_PCCS_URL, timeoutMs = 20_000 } = {},
): Promise<VerifiedQuote> {
  const { js_get_collateral, js_verify } = await import("@phala/dcap-qvl-node");
  const rawQuote = hexToBuffer(quoteHex, "intel_quote");
  const collateral = await withTimeout(js_get_collateral(pccsUrl, rawQuote), timeoutMs, "tdx_collateral");
  const result = js_verify(rawQuote, collateral, BigInt(Math.floor(Date.now() / 1000)));
  const td10 = result?.report?.TD10;
  if (!td10) throw new Error("tdx_quote: not a TD10 report");
  return {
    status: String(result.status),
    advisoryIds: Array.isArray(result.advisory_ids) ? result.advisory_ids.map(String) : [],
    tdAttributes: String(td10.td_attributes ?? ""),
    reportData: String(td10.report_data ?? ""),
    mrConfigId: String(td10.mr_config_id ?? ""),
    rtMr3: String(td10.rt_mr3 ?? ""),
  };
}

/** TDX debug mode = bit 0 of the first TD_ATTRIBUTES byte. */
export function isDebugEnabled(tdAttributesHex: string): boolean {
  const attrs = hexToBuffer(tdAttributesHex, "td_attributes");
  if (attrs.length < 1) throw new Error("td_attributes: empty");
  return (attrs[0] & 1) !== 0;
}

/** NEAR report_data without TLS binding: ecdsa address (20 B) zero-padded to 32 B, then the 32 B nonce. */
export function expectedReportData(signingAddress: string, nonceHex: string): Buffer {
  const address = hexToBuffer(signingAddress, "signing_address");
  if (address.length !== 20) throw new Error("signing_address: expected 20-byte ecdsa address");
  const nonce = hexToBuffer(nonceHex, "nonce");
  if (nonce.length !== 32) throw new Error("nonce: expected 32 bytes");
  return Buffer.concat([address, Buffer.alloc(12), nonce]);
}

type DstackEvent = { imr: number; event_type: number; digest?: string; event?: string; event_payload?: string };

/** Replay the imr=3 events of `event_log` (JSON text or array) into RTMR3. */
export function replayRtmr3(eventLog: unknown): Buffer {
  const events = typeof eventLog === "string" ? JSON.parse(eventLog) : eventLog;
  if (!Array.isArray(events)) throw new Error("event_log: not a list");
  let rtmr3: Buffer = Buffer.alloc(48);
  let count = 0;
  for (const entry of events as DstackEvent[]) {
    if (entry?.imr !== 3) continue;
    count += 1;
    rtmr3 = createHash("sha384").update(Buffer.concat([rtmr3, eventDigest(entry)])).digest();
  }
  if (count === 0) throw new Error("event_log: no imr=3 events");
  return rtmr3;
}

function eventDigest(entry: DstackEvent): Buffer {
  const stored = entry.digest ? hexToBuffer(entry.digest, "event_log.digest") : undefined;
  if (entry.event_type !== DSTACK_RUNTIME_EVENT_TYPE) {
    if (!stored || stored.length !== 48) throw new Error("event_log: missing 48-byte digest");
    return stored;
  }
  const type = Buffer.alloc(4);
  type.writeUInt32LE(DSTACK_RUNTIME_EVENT_TYPE);
  const computed = createHash("sha384")
    .update(type)
    .update(":")
    .update(String(entry.event ?? ""), "utf8")
    .update(":")
    .update(hexToBuffer(entry.event_payload ?? "", "event_log.event_payload"))
    .digest();
  if (stored && !stored.equals(computed)) throw new Error(`event_log: digest mismatch for ${entry.event}`);
  return computed;
}

/** Raw `info.tcb_info.app_compose` string; `tcb_info` may itself be JSON text. Never reserialised. */
export function readAppCompose(info: unknown): string {
  const raw = (info as { tcb_info?: unknown } | undefined)?.tcb_info;
  const tcbInfo = typeof raw === "string" ? JSON.parse(raw) : raw;
  const appCompose = (tcbInfo as { app_compose?: unknown } | undefined)?.app_compose;
  if (typeof appCompose !== "string" || appCompose.length === 0) throw new Error("tcb_info.app_compose missing");
  return appCompose;
}

/** MRCONFIGID = 0x01 || SHA-256(app_compose UTF-8 bytes) || 15 zero bytes. */
export function expectedMrConfigId(appCompose: string): Buffer {
  const hash = createHash("sha256").update(appCompose, "utf8").digest();
  return Buffer.concat([Buffer.from([1]), hash, Buffer.alloc(15)]);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

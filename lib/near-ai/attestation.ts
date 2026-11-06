// Server-only NEAR AI Cloud attestation preflight. Never import from client components.
// Run assertAttestationOrThrow() before any chat completion; if it throws, send no user code.
//
// Docs followed:
// - https://docs.near.ai/cloud/verification
// - https://docs.near.ai/cloud/verification/cloud-api/gateway-attestation
// - https://docs.near.ai/cloud/verification/cloud-api/model-attestations
// - https://docs.near.ai/cloud/verification/reference/quote-nonce-signer
// - https://docs.near.ai/api-reference/attestation/get-attestation-report
// Helpers ported from https://github.com/near-examples/nearai-cloud-verification-example (utils/api.js)
// and https://github.com/nearai/nearai-cloud-verifier (ts/model_verifier.ts, Apache-2.0).
import { randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import {
  expectedMrConfigId,
  expectedReportData,
  hexToBuffer,
  isDebugEnabled,
  readAppCompose,
  replayRtmr3,
  verifyQuoteWithDcap,
  type QuoteVerifier,
} from "./tdx";

if (typeof window !== "undefined") throw new Error("lib/near-ai/attestation is server-only");

export const NEARAI_BASE_URL = "https://cloud-api.near.ai/v1";
export const NVIDIA_NRAS_URL = "https://nras.attestation.nvidia.com/v3/attest/gpu";
export const NVIDIA_ISSUER = "https://nras.attestation.nvidia.com";
export const NVIDIA_JWKS_URL = `${NVIDIA_ISSUER}/.well-known/jwks.json`;
/** Same default TCB policy as @nearai/inference-sdk. */
export const ACCEPTED_TCB_STATUSES = ["UpToDate", "OutOfDate", "TDRelaunchAdvised"];

const FETCH_TIMEOUT_MS = 20_000;
const NONCE_RE = /^[0-9a-f]{64}$/;
const ECDSA_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export type Check = { report: string; name: string; ok: boolean; detail?: string };

export class AttestationError extends Error {
  readonly code = "attestation_failed";
  constructor(
    message: string,
    readonly checks: Check[] = [],
  ) {
    super(message);
    this.name = "AttestationError";
  }
}

export type RawReport = {
  model_name?: string;
  signing_address?: string;
  signing_algo?: string;
  request_nonce?: string;
  intel_quote?: string;
  event_log?: unknown;
  nvidia_payload?: string;
  info?: unknown;
};

export type AttestationResponse = {
  gateway_attestation?: RawReport;
  model_attestations?: RawReport[];
};

export type SignerIdentity = { report: string; signingAddress: string; signingAlgo: "ecdsa" };

export type GpuResult = { verdict: true; nonceMatches: true } | "not_present";

export type VerifiedReport = SignerIdentity & {
  tcbStatus: string;
  advisoryIds: string[];
  gpu: GpuResult;
};

/** Metadata retained for Task 04 signature checks. Contains no user code and no API key. */
export type VerifiedAttestation = {
  model: string;
  nonce: string;
  verifiedAt: string;
  gateway: VerifiedReport;
  models: VerifiedReport[];
  checks: Check[];
};

export type AttestationDeps = {
  fetch?: typeof fetch;
  verifyQuote?: QuoteVerifier;
  nvidiaKeys?: JWTVerifyGetKey;
  env?: Record<string, string | undefined>;
};

/** NEARAI_API_KEY, fallback NEARAI_CLOUD_API_KEY. */
export function getApiKey(env: Record<string, string | undefined> = process.env): string {
  const key = env.NEARAI_API_KEY?.trim() || env.NEARAI_CLOUD_API_KEY?.trim();
  if (!key) throw new AttestationError("missing_api_key", [{ report: "config", name: "api_key", ok: false }]);
  return key;
}

/** 32 random bytes as 64 lowercase hex chars (quote-nonce-signer: "Use a client-generated nonce"). */
export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

/**
 * GET /v1/attestation/report with the docs.near.ai query (model-attestations: "Request model evidence").
 * Errors carry only the HTTP status, never the response body.
 */
export async function fetchAttestationReport(
  model: string,
  nonce: string,
  deps: AttestationDeps = {},
): Promise<AttestationResponse> {
  if (!NONCE_RE.test(nonce)) throw new AttestationError("invalid_nonce");
  const apiKey = getApiKey(deps.env);
  const params = new URLSearchParams({
    model,
    provider: "near",
    include_tls_fingerprint: "false",
    signing_algo: "ecdsa",
    nonce,
  });
  const doFetch = deps.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(`${NEARAI_BASE_URL}/attestation/report?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-no-aliasing": "true",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new AttestationError("attestation_fetch_failed", [
      { report: "request", name: "fetch", ok: false, detail: "network_error" },
    ]);
  }
  if (!response.ok) {
    throw new AttestationError("attestation_fetch_failed", [
      { report: "request", name: "fetch", ok: false, detail: `http_${response.status}` },
    ]);
  }
  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") throw new Error();
    return body as AttestationResponse;
  } catch {
    throw new AttestationError("attestation_fetch_failed", [
      { report: "request", name: "fetch", ok: false, detail: "invalid_json" },
    ]);
  }
}

/** Throws unless the report echoes exactly our nonce. */
export function verifyNonceEcho(report: RawReport | undefined, nonce: string, label = "report"): void {
  const echoed = typeof report?.request_nonce === "string" ? report.request_nonce.toLowerCase() : undefined;
  if (echoed !== nonce.toLowerCase()) {
    throw new AttestationError("nonce_mismatch", [{ report: label, name: "nonce_echo", ok: false }]);
  }
}

/** Gateway + every model signer. Rejects missing/empty model_attestations and non-ecdsa signers. */
export function extractSigningAddresses(response: AttestationResponse): SignerIdentity[] {
  const models = response.model_attestations;
  if (!response.gateway_attestation) {
    throw new AttestationError("gateway_attestation_missing", [{ report: "gateway", name: "present", ok: false }]);
  }
  if (!Array.isArray(models) || models.length === 0) {
    throw new AttestationError("model_attestations_missing", [{ report: "model", name: "present", ok: false }]);
  }
  const labelled: [string, RawReport][] = [
    ["gateway", response.gateway_attestation],
    ...models.map((m, i): [string, RawReport] => [`model[${i}]`, m]),
  ];
  return labelled.map(([label, report]) => {
    if (!report || typeof report !== "object" || Array.isArray(report)) {
      throw new AttestationError("invalid_report", [{ report: label, name: "present", ok: false }]);
    }
    if (report.signing_algo !== "ecdsa" || !ECDSA_ADDRESS_RE.test(report.signing_address ?? "")) {
      throw new AttestationError("invalid_signer", [{ report: label, name: "signing_address", ok: false }]);
    }
    return { report: label, signingAddress: report.signing_address!.toLowerCase(), signingAlgo: "ecdsa" };
  });
}

/**
 * NVIDIA NRAS GPU check (quote-nonce-signer: "Verify GPU evidence when present"):
 * payload nonce must match before sending; JWT verified against NVIDIA JWKS (ES384);
 * `x-nvidia-overall-att-result` must be true and `eat_nonce` must equal our nonce.
 */
export async function verifyGpuEvidence(
  nvidiaPayload: string,
  nonce: string,
  deps: AttestationDeps = {},
): Promise<GpuResult> {
  let payloadNonce: unknown;
  try {
    payloadNonce = JSON.parse(nvidiaPayload)?.nonce;
  } catch {
    throw new Error("gpu_payload_invalid_json");
  }
  if (typeof payloadNonce !== "string" || payloadNonce.toLowerCase() !== nonce.toLowerCase()) {
    throw new Error("gpu_payload_nonce_mismatch");
  }
  const doFetch = deps.fetch ?? fetch;
  const response = await doFetch(NVIDIA_NRAS_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: nvidiaPayload,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`gpu_nras_http_${response.status}`);
  const body: unknown = await response.json();
  const entry = Array.isArray(body) ? body[0] : undefined;
  if (!Array.isArray(entry) || entry[0] !== "JWT" || typeof entry[1] !== "string") {
    throw new Error("gpu_nras_response_invalid");
  }
  const keys = deps.nvidiaKeys ?? createRemoteJWKSet(new URL(NVIDIA_JWKS_URL));
  const { payload } = await jwtVerify(entry[1], keys, {
    algorithms: ["ES384"],
    issuer: NVIDIA_ISSUER,
    requiredClaims: ["exp", "nbf", "iat"],
  });
  if (payload["x-nvidia-overall-att-result"] !== true) throw new Error("gpu_verdict_false");
  if (typeof payload.eat_nonce !== "string" || payload.eat_nonce.toLowerCase() !== nonce.toLowerCase()) {
    throw new Error("gpu_eat_nonce_mismatch");
  }
  return { verdict: true, nonceMatches: true };
}

/** All per-report checks from gateway-attestation / model-attestations "Verify ..." sections. */
async function verifyReport(
  label: string,
  report: RawReport,
  signer: SignerIdentity,
  nonce: string,
  deps: AttestationDeps,
  checks: Check[],
): Promise<VerifiedReport> {
  const step = async <T>(name: string, run: () => T | Promise<T>): Promise<T> => {
    try {
      const value = await run();
      checks.push({ report: label, name, ok: true });
      return value;
    } catch (error) {
      // Only our own snake_case codes are surfaced; never echo text from remote reports or libraries.
      const message = error instanceof Error ? error.message : "";
      const detail = /^[a-z0-9_]{1,64}$/.test(message) ? message : "failed";
      checks.push({ report: label, name, ok: false, detail });
      throw error;
    }
  };

  await step("nonce_echo", () => verifyNonceEcho(report, nonce, label));
  const quote = await step("tdx_quote", async () => {
    const verified = await (deps.verifyQuote ?? verifyQuoteWithDcap)(String(report.intel_quote ?? ""));
    if (!ACCEPTED_TCB_STATUSES.includes(verified.status)) throw new Error(`tcb_status_${verified.status}`);
    if (isDebugEnabled(verified.tdAttributes)) throw new Error("tdx_debug_enabled");
    return verified;
  });
  await step("report_data_binds_signer_and_nonce", () => {
    const actual = hexToBuffer(quote.reportData, "report_data");
    if (!actual.equals(expectedReportData(signer.signingAddress, nonce))) throw new Error("report_data_mismatch");
  });
  await step("rtmr3_event_log_replay", () => {
    if (!replayRtmr3(report.event_log).equals(hexToBuffer(quote.rtMr3, "rt_mr3"))) throw new Error("rtmr3_mismatch");
  });
  await step("mrconfigid_app_compose", () => {
    const actual = hexToBuffer(quote.mrConfigId, "mr_config_id");
    if (!actual.equals(expectedMrConfigId(readAppCompose(report.info)))) throw new Error("mrconfigid_mismatch");
  });
  // Any present nvidia_payload (even empty or non-string) must verify; only an absent field is "not_present".
  const gpu: GpuResult =
    report.nvidia_payload !== undefined
      ? await step("nvidia_gpu", () => {
          if (typeof report.nvidia_payload !== "string" || report.nvidia_payload.length === 0) {
            throw new Error("gpu_payload_invalid");
          }
          return verifyGpuEvidence(report.nvidia_payload, nonce, deps);
        })
      : "not_present";
  return { ...signer, tcbStatus: quote.status, advisoryIds: quote.advisoryIds, gpu };
}

/**
 * Fail-closed preflight: fresh nonce → report → verify gateway and EVERY model report.
 * Throws AttestationError (with `checks`) on any failure. Makes no chat completion calls.
 */
export async function assertAttestationOrThrow(
  model: string,
  deps: AttestationDeps = {},
): Promise<VerifiedAttestation> {
  const nonce = generateNonce();
  const response = await fetchAttestationReport(model, nonce, deps);
  const signers = extractSigningAddresses(response);
  const reports: RawReport[] = [response.gateway_attestation!, ...response.model_attestations!];

  const checks: Check[] = [];
  reports.slice(1).forEach((report, i) => {
    const ok = report.model_name === model;
    checks.push({ report: `model[${i}]`, name: "model_name", ok });
  });

  const results = await Promise.allSettled(
    reports.map((report, i) => verifyReport(signers[i].report, report, signers[i], nonce, deps, checks)),
  );
  if (checks.some((c) => !c.ok) || results.some((r) => r.status === "rejected")) {
    throw new AttestationError("attestation_failed", checks);
  }
  const verified = results.map((r) => (r as PromiseFulfilledResult<VerifiedReport>).value);
  return {
    model,
    nonce,
    verifiedAt: new Date().toISOString(),
    gateway: verified[0],
    models: verified.slice(1),
    checks,
  };
}

/**
 * Structured JSON logs (one line per event, readable in Vercel's log drain). Private trade fields and
 * credentials are redacted by key name, so a careless call site can't leak a fill or a secret.
 */
const REDACT = /key|secret|token|password|signature|sealed|quote|qty|usdc|price|symbol|side|cookie|authorization/i;

type Level = "info" | "warn" | "error";

export function redact(v: unknown, depth = 0): unknown {
  if (depth > 4 || v == null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => redact(x, depth + 1));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, REDACT.test(k) ? "[redacted]" : redact(x, depth + 1)]));
}

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(redact(fields) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

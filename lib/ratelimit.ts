import { headers } from "next/headers";
import { q } from "./db";
import { fail } from "./access";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "local").trim().slice(0, 64);
}

/** Fixed-window counter in Postgres. Returns seconds until the window resets when over the limit, else null. */
export async function hit(bucket: string, max: number, windowSec: number): Promise<number | null> {
  const now = Date.now() / 1000;
  const start = Math.floor(now / windowSec) * windowSec;
  const [r] = await q<{ hits: number }>(
    `insert into rate_limits (bucket, window_start, hits) values ($1, to_timestamp($2), 1)
     on conflict (bucket, window_start) do update set hits = rate_limits.hits + 1 returning hits`,
    [bucket, start],
  );
  return Number(r.hits) > max ? Math.ceil(start + windowSec - now) : null;
}

export type Rule = { name: string; max: number; windowSec: number; by: "ip" | string };

/** Checks every rule; on the first one that trips, returns a 429 response to send back. */
export async function limit(rules: Rule[]): Promise<Response | null> {
  const ip = await clientIp();
  for (const r of rules) {
    const retry = await hit(`${r.name}:${r.by === "ip" ? `ip:${ip}` : r.by}`, r.max, r.windowSec);
    if (retry != null) {
      const res = fail(`too many requests, try again in ${retry < 120 ? `${retry}s` : `${Math.ceil(retry / 60)} min`}`, 429);
      res.headers.set("Retry-After", String(retry));
      return res;
    }
  }
  return null;
}

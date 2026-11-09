import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { json } from "@/lib/access";
import { AUTH_MESSAGE } from "@/lib/near";
import { limit } from "@/lib/ratelimit";

export async function GET() {
  const limited = await limit([{ name: "challenge", max: 30, windowSec: 600, by: "ip" }]);
  if (limited) return limited;
  const nonce = randomBytes(32).toString("base64");
  (await cookies()).set("privue_nonce", nonce, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return json({ nonce, message: AUTH_MESSAGE });
}

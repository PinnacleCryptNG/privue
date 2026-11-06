import { fail, json } from "@/lib/access";
import { tick } from "@/lib/bots";

export const maxDuration = 300;

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return fail("unauthorized", 401);
  return json({ log: await tick() });
}

export const GET = handle;
export const POST = handle;

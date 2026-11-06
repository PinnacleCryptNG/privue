import { z } from "zod";
import { fail, json } from "@/lib/access";
import { ensureSeeded } from "@/lib/bots";
import { q } from "@/lib/db";
import { getTrader, listTraders } from "@/lib/engine";
import { sponsoredSetOffer } from "@/lib/near";
import { publicContext, publicTrader } from "@/lib/public";
import { getSession } from "@/lib/session";
import { MARKETS } from "@/lib/assets";

export async function GET() {
  await ensureSeeded();
  const [traders, ctx] = await Promise.all([listTraders(), publicContext()]);
  const out = await Promise.all(traders.map((t) => publicTrader(t, ctx.prices, ctx.offers)));
  return json({ traders: out.sort((a, b) => b.stats.pnlPct - a.stats.pnlPct) });
}

const Create = z.object({
  handle: z.string().regex(/^[a-z][a-z0-9-]{2,19}$/, "3–20 lowercase letters, digits or dashes"),
  name: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(160).default(""),
  style: z.string().trim().max(30).default("Discretionary"),
  viewPrice: z.number().min(0.01).max(100),
  copyPrice: z.number().min(0.01).max(100),
});

const toYocto = (near: number) => (BigInt(Math.round(near * 1e6)) * 10n ** 18n).toString();

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail("sign in first", 401);
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid profile");
  const b = parsed.data;
  const mine = await q("select 1 from traders where owner = $1", [session.sub]);
  if (mine.length) return fail("you already have a trader profile");
  if (await getTrader(b.handle)) return fail("that handle is taken");
  const owner = session.kind === "near" ? session.sub : undefined;
  const txs = [await sponsoredSetOffer(b.handle, "view", toYocto(b.viewPrice), 25, owner), await sponsoredSetOffer(b.handle, "copy", toYocto(b.copyPrice), 10, owner)];
  await q(
    "insert into traders (handle, name, owner, bio, style, markets, start_cash, is_bot) values ($1,$2,$3,$4,$5,$6,10000,false)",
    [b.handle, b.name, session.sub, b.bio, b.style, MARKETS.map((m) => m.symbol)],
  );
  return json({ handle: b.handle, txs });
}

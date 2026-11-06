import { z } from "zod";
import { fail, json } from "@/lib/access";
import { q } from "@/lib/db";
import { getTrader } from "@/lib/engine";
import { generateNote, NoteError, notesEnabled } from "@/lib/notes";
import { getSession } from "@/lib/session";

export const maxDuration = 120;

const Body = z.object({ handle: z.string() });

/** The trader asks NEAR AI for a fresh strategy note, at most once an hour. */
export async function POST(req: Request) {
  if (!notesEnabled()) return fail("strategy notes are off on this deployment", 503);
  const session = await getSession();
  if (!session) return fail("sign in first", 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid request");
  const trader = await getTrader(parsed.data.handle);
  if (!trader || trader.owner !== session.sub) return fail("only the trader can request a note", 403);
  const [recent] = await q("select 1 from notes where handle = $1 and created_at > now() - interval '1 hour'", [trader.handle]);
  if (recent) return fail("you can request one note an hour", 429);
  try {
    const note = await generateNote(trader.handle);
    return json({ body: note.body, model: note.model, signature: note.proof.signature.status });
  } catch (e) {
    if (e instanceof NoteError) return fail(e.message, 422);
    return fail("NEAR AI couldn't be verified, so no note was written", 502);
  }
}

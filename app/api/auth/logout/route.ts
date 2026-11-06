import { json } from "@/lib/access";
import { clearSession } from "@/lib/session";

export async function POST() {
  await clearSession();
  return json({ ok: true });
}

import { apiError, ok } from "@/lib/server/http";
import { destroySession, requireSession } from "@/lib/server/session";
import { verifyCsrf } from "@/lib/server/csrf";

export async function POST(request: Request) {
  try { const actor = await requireSession(); await verifyCsrf(actor.accountId, request); await destroySession(); return ok({ loggedOut: true }); }
  catch (error) { return apiError(error); }
}

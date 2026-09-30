import { apiError, ok } from "@/lib/server/http";
import { requireSession } from "@/lib/server/session";

export async function GET() { try { return ok({ actor: await requireSession() }); } catch (error) { return apiError(error); } }

import { z } from "zod";
import { callAppsScript, BackendError } from "@/lib/server/apps-script-client";
import { verifyPassword } from "@/lib/server/credentials";
import { apiError, ok, readJson } from "@/lib/server/http";
import { createSession } from "@/lib/server/session";
import type { Role } from "@/lib/domain/types";

const inputSchema = z.object({ username: z.string().trim().min(3).max(64), password: z.string().min(1).max(128), area: z.enum(["master", "admin", "portal"]) });
type LoginRecord = { id: string; username: string; displayName: string; role: Role; passwordHash: string; active: boolean };

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await readJson(request));
    const record = await callAppsScript<LoginRecord>("auth.lookup", { username: input.username });
    const allowedRole = input.area === "master" ? record.role === "MASTER_ADMIN" : input.area === "admin" ? record.role === "KOMINFO_ADMIN" : record.role === "PORTAL";
    if (!record.active || !allowedRole || !(await verifyPassword(input.password, record.passwordHash))) throw new BackendError("INVALID_CREDENTIALS", "ID atau password tidak sesuai.", 401);
    const session = await createSession(record);
    return ok(session);
  } catch (error) { return apiError(error); }
}

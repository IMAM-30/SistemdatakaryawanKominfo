import { z } from "zod";
import { authorizeAction, isPublicAction } from "@/lib/server/authorization";
import { callAppsScript, BackendError } from "@/lib/server/apps-script-client";
import { decryptPassword, protectPassword, verifyPassword } from "@/lib/server/credentials";
import { verifyCsrf } from "@/lib/server/csrf";
import { getServerEnv } from "@/lib/server/env";
import { apiError, ok, readJson } from "@/lib/server/http";
import { requireSession } from "@/lib/server/session";

const requestSchema = z.object({ action: z.string().min(1).max(80), payload: z.record(z.string(), z.unknown()).default({}) });
const READ_ONLY = new Set(["health", "settings.public", "categories.publicList", "fields.publicList", "employees.publicList", "employees.publicGet", "files.publicGet", "categories.list", "fields.list", "employees.list", "employees.get", "files.get", "settings.get", "audit.list", "accounts.listActiveAdmins", "accounts.listPortal", "accounts.listAdmins", "export.snapshot"]);

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.parse(await readJson(request));
    let actor: Awaited<ReturnType<typeof requireSession>> | null = null;
    if (!isPublicAction(parsed.action)) {
      actor = await requireSession();
      if (!authorizeAction(actor.role, parsed.action)) throw new BackendError("FORBIDDEN", "Akun tidak memiliki izin untuk tindakan ini.", 403);
      if (!READ_ONLY.has(parsed.action)) await verifyCsrf(actor.accountId, request);
    }
    let payload: Record<string, unknown> = { ...parsed.payload, actor };
    if (parsed.action === "accounts.changeOwnPassword") {
      if (!actor || typeof payload.currentPassword !== "string") throw new BackendError("VALIDATION", "Password saat ini wajib diisi.", 400);
      const record = await callAppsScript<{ passwordHash: string }>("auth.lookup", { username: actor.username });
      if (!(await verifyPassword(payload.currentPassword, record.passwordHash))) throw new BackendError("INVALID_CREDENTIALS", "Password saat ini tidak sesuai.", 401);
      delete payload.currentPassword;
    }
    if (["accounts.createAdmin", "accounts.createPortal", "accounts.resetAdminPassword", "accounts.resetPortalPassword", "accounts.changeOwnPassword"].includes(parsed.action) && typeof payload.password === "string") {
      const password = payload.password; delete payload.password;
      payload = { ...payload, ...(await protectPassword(password, getServerEnv().CREDENTIAL_ENCRYPTION_KEY)) };
    }
    const result = await callAppsScript<Record<string, unknown>>(parsed.action, payload);
    if (["accounts.revealAdminCredential", "accounts.revealPortalCredential"].includes(parsed.action)) {
      const encrypted = result.passwordEncrypted;
      if (typeof encrypted !== "string") throw new BackendError("BACKEND_RESPONSE", "Kredensial terenkripsi tidak tersedia.", 502);
      return ok({ username: result.username, password: decryptPassword(encrypted, getServerEnv().CREDENTIAL_ENCRYPTION_KEY) });
    }
    return ok(result);
  } catch (error) { return apiError(error); }
}

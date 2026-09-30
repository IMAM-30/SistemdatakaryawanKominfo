import { BackendError, callAppsScript } from "@/lib/server/apps-script-client";
import { hashSessionToken } from "@/lib/server/session";

export async function verifyCsrf(accountId: string, request: Request) {
  const token = request.headers.get("x-csrf-token");
  if (!token) throw new BackendError("FORBIDDEN", "Token CSRF tidak tersedia.", 403);
  await callAppsScript("auth.csrfVerify", { accountId, csrfHash: hashSessionToken(token) });
}

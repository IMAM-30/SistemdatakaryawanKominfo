import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Role, SessionActor } from "@/lib/domain/types";
import { callAppsScript, BackendError } from "@/lib/server/apps-script-client";
import { getServerEnv } from "@/lib/server/env";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export function hashSessionToken(token: string) { return createHash("sha256").update(token).digest("base64url"); }

export async function createSession(account: { id: string; username: string; displayName: string; role: Role }) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  await callAppsScript("auth.sessionCreate", { accountId: account.id, tokenHash: hashSessionToken(token), csrfHash: hashSessionToken(csrfToken), expiresInSeconds: SESSION_MAX_AGE_SECONDS });
  const store = await cookies();
  const cookieName = getServerEnv().SESSION_COOKIE_NAME;
  const common = { secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: SESSION_MAX_AGE_SECONDS };
  store.set(cookieName, token, { ...common, httpOnly: true });
  store.set(`${cookieName}_csrf`, csrfToken, { ...common, httpOnly: false });
  return { actor: { accountId: account.id, username: account.username, displayName: account.displayName, role: account.role }, csrfToken, expiresInSeconds: SESSION_MAX_AGE_SECONDS };
}

export async function requireSession(): Promise<SessionActor> {
  const token = (await cookies()).get(getServerEnv().SESSION_COOKIE_NAME)?.value;
  if (!token) throw new BackendError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  return callAppsScript<SessionActor>("auth.sessionGet", { tokenHash: hashSessionToken(token) });
}

export async function destroySession() {
  const store = await cookies();
  const name = getServerEnv().SESSION_COOKIE_NAME;
  const token = store.get(name)?.value;
  if (token) await callAppsScript("auth.sessionDelete", { tokenHash: hashSessionToken(token) });
  store.delete(name);
  store.delete(`${name}_csrf`);
}

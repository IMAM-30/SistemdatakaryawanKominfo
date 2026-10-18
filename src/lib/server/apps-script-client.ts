import { buildSignedEnvelope } from "@/lib/server/apps-script-signing";
import { getServerEnv } from "@/lib/server/env";

export interface ApiErrorBody { code: string; message: string; details?: unknown }
export interface ApiEnvelope<T> { ok: boolean; data?: T; error?: ApiErrorBody; meta?: { apiVersion: string; generatedAt: string } }

export class BackendError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 500, public readonly details?: unknown) { super(message); }
}

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION: 400, INVALID_JSON: 400, UNAUTHENTICATED: 401, INVALID_CREDENTIALS: 401, SESSION_EXPIRED: 401,
  FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, VERSION_CONFLICT: 409, RATE_LIMITED: 429, BACKEND_TIMEOUT: 504,
};

export async function callAppsScript<T>(action: string, payload: unknown, timeoutMs = 12_000): Promise<T> {
  const env = getServerEnv();
  const body = buildSignedEnvelope({ action, payload, secret: env.APPS_SCRIPT_HMAC_SECRET });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(env.APPS_SCRIPT_URL, {
      method: "POST", headers: { "content-type": "text/plain;charset=utf-8", "accept": "application/json" },
      body: JSON.stringify(body), signal: controller.signal, cache: "no-store",
    });
    if (!response.ok) throw new BackendError("BACKEND_HTTP", `Google backend returned HTTP ${response.status}`, 502);
    let value: unknown;
    try { value = await response.json(); }
    catch (error) {
      // Fetch can finish receiving headers while its JSON body is still pending.
      // Keep the same deadline until that body has been completely consumed.
      if (controller.signal.aborted) throw error;
      throw new BackendError("BACKEND_RESPONSE", "Respons Google backend tidak valid.", 502);
    }
    if (!value || typeof value !== "object" || Array.isArray(value) || !("ok" in value) || typeof value.ok !== "boolean") {
      throw new BackendError("BACKEND_RESPONSE", "Respons Google backend tidak valid.", 502);
    }
    const envelope = value as ApiEnvelope<T>;
    if (!envelope.ok || envelope.data === undefined) {
      const failure = envelope.error ?? { code: "BACKEND_ERROR", message: "Google backend menolak permintaan." };
      if (typeof failure !== "object" || typeof failure.code !== "string" || typeof failure.message !== "string") {
        throw new BackendError("BACKEND_RESPONSE", "Respons Google backend tidak valid.", 502);
      }
      throw new BackendError(failure.code, failure.message, STATUS_BY_CODE[failure.code] ?? 500, failure.details);
    }
    return envelope.data;
  } catch (error) {
    if (error instanceof BackendError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw new BackendError("BACKEND_TIMEOUT", "Google backend tidak merespons tepat waktu.", 504);
    throw new BackendError("BACKEND_UNAVAILABLE", "Google backend tidak dapat dihubungi.", 502);
  } finally { clearTimeout(timeout); }
}

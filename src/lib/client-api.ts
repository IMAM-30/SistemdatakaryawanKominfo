import type { SessionActor } from "@/lib/domain/types";

interface ApiFailure {
  code: string;
  message: string;
  details?: unknown;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiFailure;
}

export class ClientApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly details?: unknown) {
    super(message);
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  let body: ApiResponse<T>;
  try {
    body = await response.json() as ApiResponse<T>;
  } catch {
    throw new ClientApiError("INVALID_RESPONSE", "Respons server tidak dapat dibaca.", response.status);
  }
  if (!response.ok || !body.ok || body.data === undefined) {
    throw new ClientApiError(body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? "Permintaan tidak berhasil.", response.status, body.error?.details);
  }
  return body.data;
}

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const pair = document.cookie.split("; ").find((value) => value.slice(0, value.indexOf("=")).endsWith("_csrf"));
  return pair ? decodeURIComponent(pair.slice(pair.indexOf("=") + 1)) : "";
}

export async function getSession(): Promise<SessionActor> {
  const response = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
  const value = await readResponse<{ actor: SessionActor }>(response);
  return value.actor;
}

export async function login(input: { username: string; password: string; area: "master" | "admin" | "portal" }) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readResponse<{ actor: SessionActor; csrfToken: string; expiresInSeconds: number }>(response);
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: { "x-csrf-token": csrfToken() },
  });
  await readResponse(response);
}

export async function backend<T>(action: string, payload: Record<string, unknown> = {}, mutation = false): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (mutation) headers["x-csrf-token"] = csrfToken();
  const response = await fetch("/api/backend", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ action, payload }),
    cache: "no-store",
  });
  return readResponse<T>(response);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Terjadi kesalahan. Silakan coba kembali.";
}

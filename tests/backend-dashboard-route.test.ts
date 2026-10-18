import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/backend/route";
import { ROLES, type SessionActor } from "@/lib/domain/types";
import { BackendError, callAppsScript } from "@/lib/server/apps-script-client";
import { verifyCsrf } from "@/lib/server/csrf";
import { requireSession } from "@/lib/server/session";

vi.mock("@/lib/server/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn() }));
vi.mock("@/lib/server/apps-script-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/apps-script-client")>(),
  callAppsScript: vi.fn(),
}));

function request(action: string, payload: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/backend", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }),
  });
}

describe("authenticated dashboard snapshot route", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it.each(ROLES)("reads a %s snapshot using the server session without a mutation CSRF call", async (role) => {
    const actor: SessionActor = { accountId: "session-account", username: "session-user", displayName: "Test account", role };
    vi.mocked(requireSession).mockResolvedValue(actor);
    const snapshot = { categories: [], fields: [], employees: [], settings: {}, admins: [], portal: [], audit: [] };
    vi.mocked(callAppsScript).mockResolvedValue(snapshot);
    const response = await POST(request("dashboard.snapshot", {
      actor: { accountId: "forged-account", role: "MASTER_ADMIN" },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, data: snapshot });
    expect(requireSession).toHaveBeenCalledTimes(1);
    expect(callAppsScript).toHaveBeenCalledExactlyOnceWith("dashboard.snapshot", { actor });
    expect(verifyCsrf).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated snapshot even when the payload supplies a forged actor", async () => {
    vi.mocked(requireSession).mockRejectedValue(new BackendError("UNAUTHENTICATED", "Sign in", 401));
    const response = await POST(request("dashboard.snapshot", { actor: { role: "MASTER_ADMIN" } }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(callAppsScript).not.toHaveBeenCalled();
    expect(verifyCsrf).not.toHaveBeenCalled();
  });

  it("still requires CSRF verification for employee mutations", async () => {
    const actor: SessionActor = { accountId: "admin", username: "admin", displayName: "Admin", role: "KOMINFO_ADMIN" };
    vi.mocked(requireSession).mockResolvedValue(actor);
    vi.mocked(verifyCsrf).mockRejectedValue(new BackendError("FORBIDDEN", "CSRF required", 403));
    const response = await POST(request("employees.create", { name: "Example" }));
    expect(response.status).toBe(403);
    expect(verifyCsrf).toHaveBeenCalledTimes(1);
    expect(callAppsScript).not.toHaveBeenCalled();
  });
});

import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type Result = { ok: boolean; data: Record<string, unknown>; error?: { code: string } };
const source = ["Config.gs", "Utils.gs", "SheetStore.gs", "DomainService.gs", "AuthService.gs", "AccountService.gs", "AuditService.gs", "Router.gs", "Code.gs"]
  .map((file) => readFileSync(new URL(`../apps-script/${file}`, import.meta.url), "utf8")).join("\n");

function harness(employeeCount = 1) {
  const tables: Record<string, Row[]> = {
    SETTINGS: [{ key: "PORTAL_MODE", value: "PUBLIC" }],
    CATEGORIES: [{ id: "pns", active: true, deletedAt: "" }],
    FIELDS: [
      { categoryId: "pns", key: "name", type: "text", active: true, publicVisible: true, portalVisible: true, adminVisible: true },
      { categoryId: "pns", key: "nip", type: "text", active: true, publicVisible: false, portalVisible: true, adminVisible: true },
    ],
    EMPLOYEES: Array.from({ length: employeeCount }, (_, index) => ({ id: `employee-${index}`, categoryId: "pns", active: true, version: 1, dataJson: JSON.stringify({ name: `Pegawai ${index}`, nip: `private-${index}` }), deletedAt: "" })),
    ACCOUNTS: [{ id: "account", username: "tester", role: "PORTAL", active: true, deletedAt: "" }],
    SESSIONS: [{ accountId: "account", tokenHash: "token", expiresAt: "2099-01-01T00:00:00Z", revokedAt: "" }],
    IDEMPOTENCY: [{ requestId: "previous", expiresAt: "2099-01-01T00:00:00Z" }],
  };
  const reads: Record<string, number> = {};
  const route = vi.fn();
  const waitLock = vi.fn();
  const releaseLock = vi.fn();
  const openById = vi.fn(() => ({
    getSheetByName: (name: string) => ({
      getLastRow: () => (tables[name] ?? []).length + 1,
      getRange: (row: number, column: number, count: number, width: number) => ({
        getValues: () => {
          reads[name] = (reads[name] ?? 0) + 1;
          return (tables[name] ?? []).slice(row - 2, row - 2 + count).map((record) => headers[name].slice(column - 1, column - 1 + width).map((key) => record[key] ?? ""));
        },
        setValues: (values: unknown[][]) => {
          tables[name][row - 2] = Object.fromEntries(headers[name].map((key, index) => [key, values[0][index]]));
        },
      }),
      appendRow: (values: unknown[]) => {
        (tables[name] ??= []).push(Object.fromEntries(headers[name].map((key, index) => [key, values[index]])));
      },
    }),
  }));
  const context = createContext({
    SpreadsheetApp: { openById },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => "fixture-spreadsheet" }) },
    Utilities: { formatDate: () => new Date().toISOString(), getUuid: vi.fn(() => "audit-uuid") },
    LockService: { getScriptLock: () => ({ waitLock, releaseLock }) },
    console: { error: vi.fn() },
    verifySignedEnvelope_: (envelope: unknown) => envelope,
    ensureCurrentSchema_: vi.fn(),
    route_: route,
  });
  runInContext(source, context);
  context.output_ = (body: unknown) => body;
  const dispatch = context.route_;
  context.route_ = route;
  const headers = context.APP.TABLES as Record<string, string[]>;
  const activeRows = vi.fn(context.activeRows_);
  context.activeRows_ = activeRows;
  const call = <T = Row>(name: string, ...args: unknown[]): T => context[name](...args) as T;
  route.mockImplementation((action: string, payload: Row) => dispatch(action, payload));
  let serial = 0;
  const request = (action: string, payload: Row = {}, requestId = `request-${serial++}`): Result => call<Result>("doPost", {
    postData: { contents: JSON.stringify({ action, payload, requestId, payloadHash: JSON.stringify(payload) }) },
  });
  return { tables, reads, route, waitLock, releaseLock, openById, activeRows, call, request };
}

describe("Apps Script request performance and cache correctness", () => {
  it("records the admin username, affected employee, and exact before/after values", () => {
    const { request, tables } = harness();
    const response = request("employees.update", {
      actor: { accountId: "admin-1", username: "imam.admin", displayName: "Imam Hudzaifah", role: "KOMINFO_ADMIN" },
      id: "employee-0",
      expectedVersion: 1,
      data: { name: "Pegawai Baru", nip: "private-0" },
    });
    expect(response.ok).toBe(true);
    const audit = tables.AUDIT_LOGS.at(-1);
    expect(audit).toMatchObject({ actorId: "admin-1", actorUsername: "imam.admin", actorDisplayName: "Imam Hudzaifah", entityId: "employee-0" });
    expect(JSON.parse(String(audit?.summaryJson))).toMatchObject({
      entityName: "Pegawai Baru",
      changes: [expect.objectContaining({ field: "name", label: "name", before: "Pegawai 0", after: "Pegawai Baru" })],
    });
  });

  it("reads each required sheet once for a large public employee list and keeps private fields hidden", () => {
    const { request, reads, openById, activeRows } = harness(300);
    const response = request("employees.publicList");
    expect(response.ok).toBe(true);
    expect(response.data.items).toHaveLength(300);
    expect(response.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ data: { name: "Pegawai 299" } })]));
    expect(reads).toMatchObject({ EMPLOYEES: 1, FIELDS: 1, CATEGORIES: 1, SETTINGS: 1 });
    expect(activeRows.mock.calls.filter(([name]) => name === "FIELDS")).toHaveLength(1);
    expect(openById).toHaveBeenCalledOnce();
  });

  it("reuses the export field snapshot for every employee without trimming the export", () => {
    const { request, reads, activeRows } = harness(400);
    const response = request("export.snapshot", { actor: { accountId: "admin", role: "KOMINFO_ADMIN" } });
    expect(response.ok).toBe(true);
    expect(response.data.employees).toHaveLength(400);
    expect(response.data.fields).toHaveLength(2);
    expect(response.data.employees).toEqual(expect.arrayContaining([expect.objectContaining({ data: { name: "Pegawai 399", nip: "private-399" } })]));
    expect(reads.FIELDS).toBe(1);
    expect(activeRows.mock.calls.filter(([name]) => name === "FIELDS")).toHaveLength(1);
  });

  it("does not scan the idempotency history for read-only operations", () => {
    const { request, reads } = harness();
    expect(request("health").ok).toBe(true);
    expect(request("auth.sessionGet", { tokenHash: "token" }).ok).toBe(true);
    expect(reads.IDEMPOTENCY ?? 0).toBe(0);
  });

  it("returns independent row objects and invalidates snapshots after writes", () => {
    const { request, route, call, reads } = harness();
    route.mockImplementation(() => {
      const first = call<Row[]>("rows_", "EMPLOYEES");
      first[0].active = false;
      first.pop();
      expect(call<Row[]>("rows_", "EMPLOYEES")).toHaveLength(1);
      expect(call<Row[]>("rows_", "EMPLOYEES")[0].active).toBe(true);
      const row = call<Row[]>("rows_", "EMPLOYEES")[0];
      row.active = false;
      call("replaceRow_", "EMPLOYEES", 2, row);
      expect(call<Row[]>("rows_", "EMPLOYEES")[0].active).toBe(false);
      call("append_", "EMPLOYEES", { ...row, id: "second" });
      expect(call<Row[]>("rows_", "EMPLOYEES")).toHaveLength(2);
      return { status: "ok" };
    });
    expect(request("health").ok).toBe(true);
    expect(reads.EMPLOYEES).toBe(3);
  });

  it("refreshes authorization and public field permissions on the next request", () => {
    const { request, tables } = harness();
    expect(request("auth.sessionGet", { tokenHash: "token" }).ok).toBe(true);
    tables.SESSIONS[0].revokedAt = "2026-01-01";
    expect(request("auth.sessionGet", { tokenHash: "token" })).toMatchObject({ ok: false, error: { code: "SESSION_EXPIRED" } });
    expect(request("employees.publicList").data.items).toEqual(expect.arrayContaining([expect.objectContaining({ data: { name: "Pegawai 0" } })]));
    tables.FIELDS[0].publicVisible = false;
    expect(request("employees.publicList").data.items).toEqual(expect.arrayContaining([expect.objectContaining({ data: {} })]));
    tables.SETTINGS[0].value = "CLOSED";
    expect(request("employees.publicList")).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("clears the request snapshot when a handler fails", () => {
    const { request, route, call, tables } = harness();
    route.mockImplementationOnce(() => {
      call("rows_", "EMPLOYEES");
      throw new Error("fixture failure");
    });
    expect(request("health").ok).toBe(false);
    tables.EMPLOYEES[0].dataJson = JSON.stringify({ name: "Updated" });
    expect(request("employees.publicList").data.items).toEqual(expect.arrayContaining([expect.objectContaining({ data: { name: "Updated" } })]));
  });

  it("refreshes rows after acquiring a lock so prior reads cannot hide a concurrent write", () => {
    const { request, route, call, tables, waitLock, releaseLock } = harness();
    waitLock.mockImplementationOnce(() => { tables.EMPLOYEES[0].version = 2; });
    route.mockImplementation(() => {
      expect(call<Row[]>("rows_", "EMPLOYEES")[0].version).toBe(1);
      return call("withLock_", () => {
        expect(call<Row[]>("rows_", "EMPLOYEES")[0].version).toBe(2);
        return { status: "ok" };
      });
    });
    expect(request("health").ok).toBe(true);
    expect(releaseLock).toHaveBeenCalledOnce();
  });

  it("preserves mutation idempotency and mismatched-payload rejection", () => {
    const { request, route } = harness();
    route.mockReturnValue({ id: "created" });
    expect(request("employees.create", { name: "fixture" }, "same-request").data).toEqual({ id: "created" });
    expect(request("employees.create", { name: "fixture" }, "same-request").data).toEqual({ id: "created" });
    expect(route).toHaveBeenCalledOnce();
    expect(request("employees.create", { name: "changed" }, "same-request")).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it.each(["updateVersioned_", "restore_"])("keeps %s version checks fresh even after an earlier read in the mutation", (operation) => {
    const { request, route, tables, call } = harness();
    route.mockImplementation(() => {
      expect(call<Row[]>("rows_", "EMPLOYEES")[0].version).toBe(1);
      // Another request completes while this mutation validates its input.
      tables.EMPLOYEES[0].version = 2;
      const actor = { accountId: "admin", role: "KOMINFO_ADMIN" };
      return operation === "restore_"
        ? call(operation, "EMPLOYEES", "employee-0", 1, actor)
        : call(operation, "EMPLOYEES", "employee-0", 1, { active: false }, actor);
    });
    expect(request(operation === "restore_" ? "employees.restore" : "employees.update"))
      .toMatchObject({ ok: false, error: { code: "VERSION_CONFLICT" } });
    expect(tables.EMPLOYEES[0]).toMatchObject({ version: 2, active: true });
  });

  it("does not reuse cached rows outside a request, including after a successful request", () => {
    const { request, tables, call } = harness();
    expect(request("employees.publicList").ok).toBe(true);
    tables.EMPLOYEES[0].version = 2;
    expect(call<Row[]>("rows_", "EMPLOYEES")[0].version).toBe(2);
    tables.EMPLOYEES[0].version = 3;
    expect(call<Row[]>("rows_", "EMPLOYEES")[0].version).toBe(3);
  });
});

function dashboardHarness() {
  const test = harness();
  const { tables } = test;
  tables.CATEGORIES.push({ id: "inactive-category", active: false }, { id: "archived-category", active: true, deletedAt: "2026-01-01" });
  tables.FIELDS.push(
    { categoryId: "pns", key: "internal", type: "text", active: true, portalVisible: false, adminVisible: true },
    { categoryId: "pns", key: "inactive", type: "text", active: false, portalVisible: true, adminVisible: true },
    { categoryId: "pns", key: "deleted", type: "text", active: true, portalVisible: true, adminVisible: true, deletedAt: "2026-01-01" },
    { categoryId: "inactive-category", key: "hiddenCategory", type: "text", active: true, portalVisible: true, adminVisible: true },
  );
  tables.EMPLOYEES[0].dataJson = JSON.stringify({ name: "Visible", nip: "portal-nip", internal: "admin-only", inactive: "hidden-inactive", deleted: "hidden-deleted" });
  tables.EMPLOYEES.push(
    { ...tables.EMPLOYEES[0], id: "inactive", active: false },
    { ...tables.EMPLOYEES[0], id: "archived", deletedAt: "2026-01-01" },
    { ...tables.EMPLOYEES[0], id: "inactive-category", categoryId: "inactive-category" },
    { ...tables.EMPLOYEES[0], id: "archived-category", categoryId: "archived-category" },
  );
  tables.ACCOUNTS = [
    { id: "master", role: "MASTER_ADMIN", active: true },
    ...["KOMINFO_ADMIN", "PORTAL"].flatMap((role) => [
      { id: `${role}-active`, role, active: true },
      { id: `${role}-inactive`, role, active: false },
      { id: `${role}-archived`, role, active: false, deletedAt: "2026-01-01" },
    ]),
  ].map((account) => ({ ...account, username: account.id, displayName: account.id, version: 1, passwordHash: "hash-secret", passwordEncrypted: "encrypted-secret" }));
  tables.AUDIT_LOGS = Array.from({ length: 120 }, (_, index) => ({ id: `audit-${index}`, action: "employees.update", summaryJson: JSON.stringify({ index }) }));
  tables.SETTINGS.push({ key: "INTERNAL_SETTING", value: "admin-setting" });
  return test;
}

describe("dashboard snapshot contract", () => {
  it.each(["MASTER_ADMIN", "KOMINFO_ADMIN"])("returns the complete %s dashboard using one read of each sheet", (role) => {
    const { request, reads, openById, tables } = dashboardHarness();
    const response = request("dashboard.snapshot", { actor: { accountId: "admin", role }, includeDeleted: false, categoryId: "ignored", limit: 500 });
    expect(response.ok).toBe(true);
    expect(Object.keys(response.data).sort()).toEqual(["admins", "audit", "categories", "employees", "fields", "portals", "settings"]);
    expect(response.data.categories).toHaveLength(3);
    expect(response.data.fields).toHaveLength(6);
    expect(response.data.employees).toHaveLength(5);
    expect(response.data.employees).toEqual(expect.arrayContaining([expect.objectContaining({ id: "employee-0", data: { name: "Visible", nip: "portal-nip", internal: "admin-only" } })]));
    expect(response.data.admins).toHaveLength(role === "MASTER_ADMIN" ? 3 : 0);
    expect(response.data.portals).toHaveLength(role === "MASTER_ADMIN" ? 3 : 2);
    expect(response.data.portals).toEqual(expect.arrayContaining([expect.objectContaining({ id: "PORTAL-inactive", active: false })]));
    expect(response.data.settings).toEqual({ PORTAL_MODE: "PUBLIC", INTERNAL_SETTING: "admin-setting" });
    expect(response.data.audit).toHaveLength(100);
    expect((response.data.audit as Row[])[0]).toMatchObject({ id: "audit-119", summary: { index: 119 } });
    expect((response.data.audit as Row[])[99]).toMatchObject({ id: "audit-20" });
    expect(JSON.stringify(response.data)).not.toMatch(/hash-secret|encrypted-secret/);
    expect(reads).toEqual({ CATEGORIES: 1, FIELDS: 1, EMPLOYEES: 1, ACCOUNTS: 1, AUDIT_LOGS: 1, SETTINGS: 1 });
    expect(openById).toHaveBeenCalledOnce();
    expect(tables.IDEMPOTENCY).toHaveLength(1);
  });

  it("keeps Portal visibility and ignores client attempts to request administrative data", () => {
    const { request, reads } = dashboardHarness();
    const response = request("dashboard.snapshot", {
      actor: { accountId: "portal", role: "PORTAL" }, role: "MASTER_ADMIN", includeDeleted: true, categoryId: "inactive-category", limit: 500,
    });
    expect(response.ok).toBe(true);
    expect(response.data.categories).toHaveLength(1);
    expect(response.data.fields).toHaveLength(2);
    expect(response.data.employees).toHaveLength(1);
    expect(response.data.employees).toEqual([expect.objectContaining({ id: "employee-0", data: { name: "Visible", nip: "portal-nip" } })]);
    expect(response.data).toMatchObject({ admins: [], portals: [], audit: [], settings: {} });
    expect(reads).toEqual({ SETTINGS: 1, CATEGORIES: 1, FIELDS: 1, EMPLOYEES: 1 });
  });

  it("rejects Portal snapshots when closed without leaking a partial response", () => {
    const { request, tables, reads } = dashboardHarness();
    tables.SETTINGS[0].value = "CLOSED";
    const response = request("dashboard.snapshot", { actor: { accountId: "portal", role: "PORTAL" } });
    expect(response).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(response).not.toHaveProperty("data");
    expect(reads).toEqual({ SETTINGS: 1 });
  });

  it.each([{}, { actor: { accountId: "unknown", role: "UNKNOWN" } }])("rejects missing or invalid actors before reading dashboard data", (payload) => {
    const { request, reads } = dashboardHarness();
    expect(request("dashboard.snapshot", payload)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(reads).toEqual({});
  });
});

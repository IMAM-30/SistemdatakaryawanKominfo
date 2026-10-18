import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type Audience = "PUBLIC" | "PORTAL";
const services = ["DomainService.gs", "PhotoService.gs"].map((file) => readFileSync(new URL(`../apps-script/${file}`, import.meta.url), "utf8")).join("\n");

function harness() {
  const tables: Record<string, Row[]> = {
    SETTINGS: [{ key: "PORTAL_MODE", value: "PUBLIC" }],
    CATEGORIES: [{ id: "pns", active: true, deletedAt: "" }],
    FIELDS: [
      { id: "name", categoryId: "pns", key: "name", type: "text", active: true, publicVisible: true, portalVisible: true, adminVisible: true },
      { id: "photo", categoryId: "pns", key: "photo", type: "photo", active: true, publicVisible: true, portalVisible: true, adminVisible: true },
    ],
    EMPLOYEES: [{ id: "employee", categoryId: "pns", active: true, deletedAt: "", photoFileId: "photo", dataJson: JSON.stringify({ name: "Pegawai Uji" }), version: 1 }],
    // New employee uploads legitimately have no employeeId until the employee is saved.
    FILES: [{ id: "photo", employeeId: "", driveFileId: "drive-photo", state: "ACTIVE", deletedAt: "", name: "foto.png", mimeType: "image/png" }],
  };
  const driveRead = vi.fn(() => ({ getBlob: () => ({ getBytes: () => [1, 2, 3] }) }));
  const context = createContext({
    bool_: (value: unknown) => value === true || String(value).toLowerCase() === "true",
    parseJson_: (value: string, fallback: unknown) => { try { return JSON.parse(value); } catch { return fallback; } },
    stripRow_: (row: Row) => ({ ...row }),
    rows_: (name: string) => structuredClone(tables[name] ?? []),
    activeRows_: (name: string) => structuredClone((tables[name] ?? []).filter((row) => !row.deletedAt)),
    findOne_: (name: string, predicate: (row: Row) => boolean) => structuredClone((tables[name] ?? []).find(predicate)),
    requireActor_: (payload: Row, roles: string[]) => {
      const role = String(payload.role ?? "PORTAL");
      if (!roles.includes(role)) throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
      return { role, accountId: "test-account" };
    },
    appError_: (code: string, message: string) => Object.assign(new Error(message), { code }),
    DriveApp: { getFileById: driveRead },
    Utilities: { base64Encode: () => "AQID" },
  });
  runInContext(services, context);
  const call = <T = Row>(name: string, ...args: unknown[]): T => context[name](...args) as T;
  return { tables, driveRead, call };
}

describe.each<Audience>(["PUBLIC", "PORTAL"])("%s reader privacy", (audience) => {
  const isPublic = audience === "PUBLIC";
  const photoAction = isPublic ? "getPublicPhoto_" : "getPhoto_";
  const visibility = isPublic ? "publicVisible" : "portalVisible";

  it("serves a currently attached allowed photo and retains its employee reference", () => {
    const { call, driveRead, tables } = harness();
    expect(call(photoAction, { id: "photo" })).toMatchObject({ id: "photo", base64: "AQID" });
    expect(driveRead).toHaveBeenCalledOnce();
    expect(call("employeeView_", tables.EMPLOYEES[0], audience)).toHaveProperty("photoFileId", "photo");
    expect(call("employeeList_", {}, isPublic)).toMatchObject({ total: 1, items: [{ id: "employee", photoFileId: "photo", data: { name: "Pegawai Uji" } }] });
    expect(call("employeeGet_", { id: "employee" }, isPublic)).toHaveProperty("photoFileId", "photo");
    expect(call<{ items: Row[] }>("fieldList_", {}, isPublic).items).toHaveLength(2);
  });

  it.each(["private", "inactive", "deleted", "missing", "other-category"])("blocks a %s photo field before accessing Drive", (state) => {
    const { call, driveRead, tables } = harness();
    const field = tables.FIELDS[1];
    if (state === "private") field[visibility] = false;
    if (state === "inactive") field.active = false;
    if (state === "deleted") field.deletedAt = "2026-01-01";
    if (state === "missing") tables.FIELDS.pop();
    if (state === "other-category") field.categoryId = "other";
    expect(() => call(photoAction, { id: "photo" })).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    expect(driveRead).not.toHaveBeenCalled();
    expect(call("employeeView_", tables.EMPLOYEES[0], audience)).not.toHaveProperty("photoFileId");
  });

  it.each(["inactive", "archived", "unattached", "replaced"])("blocks a photo whose employee is %s", (state) => {
    const { call, driveRead, tables } = harness();
    if (state === "inactive") tables.EMPLOYEES[0].active = false;
    if (state === "archived") tables.EMPLOYEES[0].deletedAt = "2026-01-01";
    if (state === "unattached") tables.EMPLOYEES.length = 0;
    if (state === "replaced") tables.EMPLOYEES[0].photoFileId = "replacement";
    expect(() => call(photoAction, { id: "photo" })).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    expect(driveRead).not.toHaveBeenCalled();
  });

  it.each(["deleted", "trashed", "missing"])("continues rejecting %s file metadata", (state) => {
    const { call, driveRead, tables } = harness();
    if (state === "deleted") tables.FILES[0].deletedAt = "2026-01-01";
    if (state === "trashed") tables.FILES[0].state = "TRASHED";
    if (state === "missing") tables.FILES.length = 0;
    expect(() => call(photoAction, { id: "photo" })).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    expect(driveRead).not.toHaveBeenCalled();
  });

  it.each(["inactive", "deleted", "missing"])("hides %s categories from employee, field, and photo reads", (state) => {
    const { call, driveRead, tables } = harness();
    if (state === "inactive") tables.CATEGORIES[0].active = false;
    if (state === "deleted") tables.CATEGORIES[0].deletedAt = "2026-01-01";
    if (state === "missing") tables.CATEGORIES.length = 0;
    expect(call("employeeList_", {}, isPublic)).toMatchObject({ items: [], total: 0 });
    expect(call("fieldList_", {}, isPublic)).toMatchObject({ items: [] });
    expect(() => call("employeeGet_", { id: "employee" }, isPublic)).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    expect(() => call(photoAction, { id: "photo" })).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    expect(driveRead).not.toHaveBeenCalled();
  });

  it("blocks photo downloads when the portal is closed", () => {
    const { call, driveRead, tables } = harness();
    tables.SETTINGS[0].value = "CLOSED";
    expect(() => call(photoAction, { id: "photo" })).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(driveRead).not.toHaveBeenCalled();
  });
});

describe("photo access compatibility", () => {
  it("allows Portal-only photos after login while rejecting anonymous access", () => {
    const { call, tables } = harness();
    tables.FIELDS[1].publicVisible = false;
    expect(call("getPhoto_", { id: "photo", role: "PORTAL" })).toHaveProperty("base64", "AQID");
    expect(() => call("getPublicPhoto_", { id: "photo" })).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    tables.SETTINGS[0].value = "LOGIN_REQUIRED";
    expect(call("getPhoto_", { id: "photo", role: "PORTAL" })).toHaveProperty("base64", "AQID");
    expect(() => call("getPublicPhoto_", { id: "photo" })).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it.each(["MASTER_ADMIN", "KOMINFO_ADMIN"])("preserves %s access to archived records and unattached uploaded photos", (role) => {
    const { call, tables } = harness();
    tables.SETTINGS[0].value = "CLOSED";
    tables.CATEGORIES[0].active = false;
    tables.CATEGORIES[0].deletedAt = "2026-01-01";
    tables.EMPLOYEES[0].active = false;
    tables.EMPLOYEES[0].deletedAt = "2026-01-01";
    tables.FIELDS[1].publicVisible = false;
    tables.FIELDS[1].portalVisible = false;
    expect(call("employeeList_", { role, includeDeleted: true }, false)).toMatchObject({ total: 1 });
    expect(call("employeeGet_", { role, id: "employee" }, false)).toHaveProperty("photoFileId", "photo");
    tables.EMPLOYEES.length = 0;
    expect(call("getPhoto_", { role, id: "photo" })).toHaveProperty("base64", "AQID");
  });
});

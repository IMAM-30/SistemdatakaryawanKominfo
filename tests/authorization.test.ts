import { describe, expect, it } from "vitest";
import { authorizeAction, isPublicAction } from "@/lib/server/authorization";
import { ROLES } from "@/lib/domain/types";

describe("action authorization", () => {
  it.each(ROLES)("allows the authenticated dashboard snapshot for %s", (role) => {
    expect(authorizeAction(role, "dashboard.snapshot")).toBe(true);
  });

  it("never exposes the dashboard snapshot as a public action", () => {
    expect(isPublicAction("dashboard.snapshot")).toBe(false);
  });

  it("keeps master-only account actions unavailable to Kominfo admins", () => {
    expect(authorizeAction("MASTER_ADMIN", "accounts.revealAdminCredential")).toBe(true);
    expect(authorizeAction("KOMINFO_ADMIN", "accounts.revealAdminCredential")).toBe(false);
  });

  it("lets Kominfo admins fully manage employee data and portal accounts", () => {
    expect(authorizeAction("KOMINFO_ADMIN", "employees.create")).toBe(true);
    expect(authorizeAction("KOMINFO_ADMIN", "fields.create")).toBe(true);
    expect(authorizeAction("KOMINFO_ADMIN", "accounts.createPortal")).toBe(true);
    expect(authorizeAction("KOMINFO_ADMIN", "accounts.updateOwnProfilePhoto")).toBe(true);
    expect(authorizeAction("MASTER_ADMIN", "accounts.updateOwnProfilePhoto")).toBe(true);
  });

  it("keeps portal accounts read-only", () => {
    expect(authorizeAction("PORTAL", "employees.list")).toBe(true);
    expect(authorizeAction("PORTAL", "employees.update")).toBe(false);
    expect(authorizeAction("PORTAL", "accounts.updateOwnProfilePhoto")).toBe(false);
  });

  it("only exposes the explicitly public file action without a role", () => {
    expect(authorizeAction("PORTAL", "files.publicGet")).toBe(true);
    expect(authorizeAction("PORTAL", "files.delete")).toBe(false);
  });
});

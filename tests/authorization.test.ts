import { describe, expect, it } from "vitest";
import { authorizeAction } from "@/lib/server/authorization";

describe("action authorization", () => {
  it("keeps master-only account actions unavailable to Kominfo admins", () => {
    expect(authorizeAction("MASTER_ADMIN", "accounts.revealAdminCredential")).toBe(true);
    expect(authorizeAction("KOMINFO_ADMIN", "accounts.revealAdminCredential")).toBe(false);
  });

  it("lets Kominfo admins fully manage employee data and portal accounts", () => {
    expect(authorizeAction("KOMINFO_ADMIN", "employees.create")).toBe(true);
    expect(authorizeAction("KOMINFO_ADMIN", "fields.create")).toBe(true);
    expect(authorizeAction("KOMINFO_ADMIN", "accounts.createPortal")).toBe(true);
  });

  it("keeps portal accounts read-only", () => {
    expect(authorizeAction("PORTAL", "employees.list")).toBe(true);
    expect(authorizeAction("PORTAL", "employees.update")).toBe(false);
  });

  it("only exposes the explicitly public file action without a role", () => {
    expect(authorizeAction("PORTAL", "files.publicGet")).toBe(true);
    expect(authorizeAction("PORTAL", "files.delete")).toBe(false);
  });
});

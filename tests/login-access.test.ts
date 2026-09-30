import { describe, expect, it } from "vitest";
import { isRoleAllowedForLoginArea, loginPathForRole, LOGIN_AREAS } from "@/lib/login-access";

describe("login access contract", () => {
  it("keeps the public login dedicated to Portal accounts", () => {
    expect(LOGIN_AREAS).toEqual(["admin", "portal"]);
    expect(isRoleAllowedForLoginArea("portal", "PORTAL")).toBe(true);
    expect(isRoleAllowedForLoginArea("portal", "KOMINFO_ADMIN")).toBe(false);
    expect(isRoleAllowedForLoginArea("portal", "MASTER_ADMIN")).toBe(false);
  });

  it("lets Kominfo Admin and Master use the same admin entrance", () => {
    expect(isRoleAllowedForLoginArea("admin", "KOMINFO_ADMIN")).toBe(true);
    expect(isRoleAllowedForLoginArea("admin", "MASTER_ADMIN")).toBe(true);
    expect(isRoleAllowedForLoginArea("admin", "PORTAL")).toBe(false);
    expect(loginPathForRole("KOMINFO_ADMIN")).toBe("/admin");
    expect(loginPathForRole("MASTER_ADMIN")).toBe("/admin");
    expect(loginPathForRole("PORTAL")).toBe("/login");
  });
});

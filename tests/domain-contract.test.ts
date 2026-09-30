import { describe, expect, it } from "vitest";
import { PORTAL_MODES, ROLES } from "@/lib/domain/types";

describe("domain contract", () => {
  it("keeps role and portal mode values stable", () => {
    expect(ROLES).toEqual(["MASTER_ADMIN", "KOMINFO_ADMIN", "PORTAL"]);
    expect(PORTAL_MODES).toEqual(["PUBLIC", "LOGIN_REQUIRED", "CLOSED"]);
  });
});

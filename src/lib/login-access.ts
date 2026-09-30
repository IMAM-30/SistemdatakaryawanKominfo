import type { Role } from "@/lib/domain/types";

export const LOGIN_AREAS = ["admin", "portal"] as const;
export type LoginArea = (typeof LOGIN_AREAS)[number];

export function isRoleAllowedForLoginArea(area: LoginArea, role: Role): boolean {
  if (area === "portal") return role === "PORTAL";
  return role === "MASTER_ADMIN" || role === "KOMINFO_ADMIN";
}

export function loginPathForRole(role: Role): "/admin" | "/login" {
  return role === "PORTAL" ? "/login" : "/admin";
}

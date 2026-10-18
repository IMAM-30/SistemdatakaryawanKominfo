import type { Role } from "@/lib/domain/types";

const PUBLIC_ACTIONS = new Set(["health", "settings.public", "categories.publicList", "fields.publicList", "employees.publicList", "employees.publicGet", "files.publicGet"]);
const PORTAL_ACTIONS = new Set(["dashboard.snapshot", "categories.list", "fields.list", "employees.list", "employees.get", "files.get"]);
const ADMIN_ACTIONS = new Set([
  "settings.get", "settings.update", "categories.create", "categories.update", "categories.delete", "categories.restore",
  "fields.create", "fields.update", "fields.delete", "fields.restore", "employees.create", "employees.update", "employees.delete",
  "employees.restore", "files.upload", "files.delete", "audit.list", "accounts.listActiveAdmins", "accounts.listPortal",
  "accounts.createPortal", "accounts.updatePortal", "accounts.deletePortal", "accounts.restorePortal", "accounts.revealPortalCredential",
  "accounts.resetPortalPassword", "accounts.changeOwnPassword", "export.snapshot",
]);
const MASTER_ACTIONS = new Set([
  "accounts.listAdmins", "accounts.createAdmin", "accounts.updateAdmin", "accounts.deleteAdmin", "accounts.restoreAdmin",
  "accounts.revealAdminCredential", "accounts.resetAdminPassword",
]);

export function authorizeAction(role: Role, action: string): boolean {
  if (PUBLIC_ACTIONS.has(action)) return true;
  if (role === "PORTAL") return PORTAL_ACTIONS.has(action);
  if (role === "KOMINFO_ADMIN") return PORTAL_ACTIONS.has(action) || ADMIN_ACTIONS.has(action);
  return PORTAL_ACTIONS.has(action) || ADMIN_ACTIONS.has(action) || MASTER_ACTIONS.has(action);
}

export function isPublicAction(action: string): boolean {
  return PUBLIC_ACTIONS.has(action);
}

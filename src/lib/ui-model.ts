import type { Role } from "@/lib/domain/types";

export type ThemeMode = "light" | "dark";

export interface UiCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
  sortOrder?: number;
  version?: number;
  deletedAt?: string;
}

export interface UiField {
  id: string;
  categoryId: string;
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean" | "textarea" | "photo";
  required: boolean;
  options?: string[];
  tableVisible: boolean;
  publicVisible: boolean;
  portalVisible: boolean;
  adminVisible: boolean;
  sortOrder: number;
  active: boolean;
  system: boolean;
  version: number;
  deletedAt?: string;
}

export interface UiEmployee {
  id: string;
  categoryId: string;
  data: Record<string, unknown>;
  photoFileId?: string;
  active: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface UiAccount {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  version: number;
  lastLoginAt?: string;
  createdAt?: string;
  deletedAt?: string;
}

export interface UiAudit {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary?: Record<string, unknown>;
  createdAt: string;
}

export interface NavigationItem {
  id: "overview" | "employees" | "accounts" | "fields" | "audit" | "settings";
  label: string;
}

const NAVIGATION: NavigationItem[] = [
  { id: "overview", label: "Ringkasan" },
  { id: "employees", label: "Data Pegawai" },
  { id: "accounts", label: "Kelola Akun" },
  { id: "fields", label: "Kategori & Kolom" },
  { id: "audit", label: "Aktivitas" },
  { id: "settings", label: "Pengaturan" },
];

export function navigationForRole(role: Role): NavigationItem[] {
  if (role === "PORTAL") return NAVIGATION.filter((item) => item.id === "overview" || item.id === "employees");
  return NAVIGATION;
}

export function deriveDashboardStats(categories: UiCategory[], employees: UiEmployee[]) {
  const active = employees.filter((employee) => employee.active && !employee.deletedAt);
  const byCategory: Record<string, number> = {};
  categories.forEach((category) => { byCategory[category.code] = 0; });
  active.forEach((employee) => {
    const category = categories.find((item) => item.id === employee.categoryId);
    if (category) byCategory[category.code] = (byCategory[category.code] ?? 0) + 1;
  });
  return {
    total: active.length,
    inactive: employees.filter((employee) => !employee.active || Boolean(employee.deletedAt)).length,
    byCategory,
  };
}

export function employeeName(employee: UiEmployee): string {
  return String(employee.data.name ?? employee.data.nama ?? employee.data.fullName ?? "Pegawai tanpa nama");
}

export function filterEmployees(employees: UiEmployee[], query: string, categoryId: string): UiEmployee[] {
  const needle = query.trim().toLocaleLowerCase("id-ID");
  return employees.filter((employee) => {
    if (categoryId !== "all" && employee.categoryId !== categoryId) return false;
    if (!needle) return true;
    return Object.values(employee.data).some((value) => String(value ?? "").toLocaleLowerCase("id-ID").includes(needle));
  });
}

const EMPLOYEE_IDENTITY_KEYS = new Set(["name", "nama", "fullName"]);

export function tableFieldsForCategory(fields: UiField[], categoryId: string): UiField[] {
  const unique = new Map<string, UiField>();
  fields
    .filter((field) => field.active && !field.deletedAt && field.tableVisible && !EMPLOYEE_IDENTITY_KEYS.has(field.key) && (categoryId === "all" || field.categoryId === categoryId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((field) => { if (!unique.has(field.key)) unique.set(field.key, field); });
  return [...unique.values()].slice(0, 4);
}

export function resolveTheme(saved: string | null, prefersDark: boolean): ThemeMode {
  if (saved === "light" || saved === "dark") return saved;
  return prefersDark ? "dark" : "light";
}

export interface ExportSheet {
  name: string;
  headers: string[];
  rows: Array<Array<string | number | boolean>>;
}

export function buildExportSheets(categories: UiCategory[], fields: UiField[], employees: UiEmployee[]): ExportSheet[] {
  return categories
    .filter((category) => !category.deletedAt)
    .map((category) => {
      const categoryFields = fields
        .filter((field) => field.categoryId === category.id && field.active && !field.deletedAt && field.type !== "photo")
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const categoryEmployees = employees.filter((employee) => employee.categoryId === category.id && !employee.deletedAt);
      return {
        name: category.code === "NON_PNS" ? "Non-ASN" : category.code,
        headers: ["No.", ...categoryFields.map((field) => field.label), "Status"],
        rows: categoryEmployees.map((employee, index) => [
          index + 1,
          ...categoryFields.map((field) => exportCell(employee.data[field.key])),
          employee.active ? "Aktif" : "Tidak aktif",
        ]),
      };
    });
}

function exportCell(value: unknown): string | number | boolean {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

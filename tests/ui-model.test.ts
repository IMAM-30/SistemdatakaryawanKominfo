import { describe, expect, it } from "vitest";
import {
  buildExportSheets,
  deriveDashboardStats,
  filterEmployees,
  navigationForRole,
  resolveTheme,
  tableFieldsForCategory,
  type UiCategory,
  type UiEmployee,
} from "../src/lib/ui-model";

const categories: UiCategory[] = [
  { id: "pns", code: "PNS", name: "Pegawai Negeri Sipil", active: true },
  { id: "pppk", code: "PPPK", name: "PPPK", active: true },
  { id: "non", code: "NON_PNS", name: "Non-ASN", active: true },
];

const employees: UiEmployee[] = [
  { id: "1", categoryId: "pns", data: { name: "Muhammad Fadli", nip: "198203142008031001", position: "Pranata Humas" }, active: true, version: 1 },
  { id: "2", categoryId: "pns", data: { name: "Sitti Nurhaliza", nip: "198507222010012002" }, active: false, version: 1 },
  { id: "3", categoryId: "pppk", data: { name: "Nico Robin", position: "Analis Data" }, active: true, version: 1 },
];

describe("dashboard UI model", () => {
  it("derives totals per category and counts only active employees", () => {
    expect(deriveDashboardStats(categories, employees)).toEqual({
      total: 2,
      inactive: 1,
      byCategory: { PNS: 1, PPPK: 1, NON_PNS: 0 },
    });
  });

  it("searches employee values and filters by category", () => {
    expect(filterEmployees(employees, "031001", "all").map((item) => item.id)).toEqual(["1"]);
    expect(filterEmployees(employees, "analis", "pppk").map((item) => item.id)).toEqual(["3"]);
  });

  it("shows master-only account administration without exposing it to portal accounts", () => {
    expect(navigationForRole("MASTER_ADMIN").map((item) => item.id)).toContain("accounts");
    expect(navigationForRole("PORTAL").map((item) => item.id)).toEqual(["overview", "employees"]);
  });

  it("uses the saved theme before the system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("does not duplicate employee name in dynamic table columns", () => {
    const fields = [
      { id: "pns-name", categoryId: "pns", key: "name", label: "Nama", type: "text", required: true, tableVisible: true, publicVisible: true, portalVisible: true, adminVisible: true, sortOrder: 1, active: true, system: true, version: 1 },
      { id: "pns-nip", categoryId: "pns", key: "nip", label: "NIP", type: "text", required: true, tableVisible: true, publicVisible: false, portalVisible: true, adminVisible: true, sortOrder: 2, active: true, system: true, version: 1 },
      { id: "pppk-name", categoryId: "pppk", key: "name", label: "Nama", type: "text", required: true, tableVisible: true, publicVisible: true, portalVisible: true, adminVisible: true, sortOrder: 1, active: true, system: true, version: 1 },
      { id: "pppk-nip", categoryId: "pppk", key: "nip", label: "NIP", type: "text", required: true, tableVisible: true, publicVisible: false, portalVisible: true, adminVisible: true, sortOrder: 2, active: true, system: true, version: 1 },
    ] as const;

    expect(tableFieldsForCategory([...fields], "all").map((field) => field.key)).toEqual(["nip"]);
    expect(tableFieldsForCategory([...fields], "pppk").map((field) => field.key)).toEqual(["nip"]);
  });

  it("builds category-specific export sheets with stable field order", () => {
    const sheets = buildExportSheets(
      categories,
      [
        { id: "name", categoryId: "pns", key: "name", label: "Nama", type: "text", required: true, tableVisible: true, publicVisible: true, portalVisible: true, adminVisible: true, sortOrder: 1, active: true, system: true, version: 1 },
        { id: "nip", categoryId: "pns", key: "nip", label: "NIP", type: "text", required: true, tableVisible: true, publicVisible: false, portalVisible: true, adminVisible: true, sortOrder: 2, active: true, system: true, version: 1 },
      ],
      employees,
    );

    expect(sheets[0]).toMatchObject({ name: "PNS", headers: ["No.", "Nama", "NIP", "Status"] });
    expect(sheets[0].rows[0]).toEqual([1, "Muhammad Fadli", "198203142008031001", "Aktif"]);
    expect(sheets[0].rows[1]).toEqual([2, "Sitti Nurhaliza", "198507222010012002", "Tidak aktif"]);
  });
});

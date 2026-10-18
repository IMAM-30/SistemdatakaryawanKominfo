import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { UiAccount, UiAudit, UiCategory, UiEmployee, UiField } from "../src/lib/ui-model";

const actor = { accountId: "test-master", username: "mastertest", displayName: "Admin Master Pengujian", role: "MASTER_ADMIN" };
const pad = (value: number) => String(value).padStart(2, "0");
const categories: UiCategory[] = Array.from({ length: 25 }, (_, index) => ({ id: `category-${pad(index + 1)}`, code: `CAT${pad(index + 1)}`, name: `Kategori ${pad(index + 1)}`, active: true, version: 1 }));
const fields: UiField[] = categories.slice(0, 2).flatMap((category) => Array.from({ length: 25 }, (_, index) => ({
  id: `${category.id}-field-${pad(index + 1)}`, categoryId: category.id, key: index === 0 ? "name" : index === 1 ? "position" : `field${index + 1}`,
  label: index === 0 ? "Nama Lengkap" : index === 1 ? "Jabatan" : `Kolom ${pad(index + 1)}`, type: "text", required: false,
  tableVisible: index < 2, publicVisible: index < 2, portalVisible: true, adminVisible: true, sortOrder: index, active: true, system: index === 0, version: 1,
})));
const employees: UiEmployee[] = Array.from({ length: 50 }, (_, index) => ({
  id: `employee-${pad(index + 1)}`, categoryId: categories[index % 2].id, data: { name: `${index < 25 ? "Pegawai" : "Arsip"} ${pad(index % 25 + 1)}`, position: "Pengelola Sistem" }, active: index < 25, version: 1,
}));
const accounts = (role: "KOMINFO_ADMIN" | "PORTAL"): UiAccount[] => Array.from({ length: 25 }, (_, index) => ({ id: `${role}-${index + 1}`, username: `${role.toLowerCase()}${pad(index + 1)}`, displayName: `${role === "PORTAL" ? "Portal" : "Admin"} ${pad(index + 1)}`, role, active: true, version: 1 }));
const audit: UiAudit[] = Array.from({ length: 25 }, (_, index) => ({ id: `audit-${pad(index + 1)}`, actorId: "test-master", actorRole: "MASTER_ADMIN", action: index % 2 ? "employees.update" : "employees.create", entityType: "employees", entityId: `employee-${pad(index + 1)}`, summary: { name: `Pegawai ${pad(index + 1)}` }, createdAt: "2026-10-18T10:00:00.000Z" }));

async function mockDashboard(page: Page) {
  const unexpected: string[] = [];
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ok: true, data: { actor } } }));
  await page.route("**/api/backend", async (route) => {
    const { action } = route.request().postDataJSON() as { action: string };
    const responses: Record<string, unknown> = {
      "categories.list": { items: categories }, "fields.list": { items: fields }, "employees.list": { items: employees },
      "accounts.listAdmins": { items: accounts("KOMINFO_ADMIN") }, "accounts.listPortal": { items: accounts("PORTAL") },
      "audit.list": { items: audit }, "settings.get": { PORTAL_MODE: "PUBLIC" },
      "export.snapshot": { categories, fields, employees },
    };
    if (!(action in responses)) unexpected.push(action);
    await route.fulfill({ status: action in responses ? 200 : 400, json: { ok: action in responses, data: responses[action] ?? {}, error: { message: "Unexpected backend action in read-only test" } } });
  });
  return unexpected;
}

async function mockPublic(page: Page) {
  const publicCategories = categories.slice(0, 2);
  const publicFields: UiField[] = publicCategories.flatMap((category, categoryIndex) => [
    { ...fields[0], id: `${category.id}-name`, categoryId: category.id },
    { ...fields[1], id: `${category.id}-position`, categoryId: category.id, publicVisible: categoryIndex === 0 },
    { ...fields[2], id: `${category.id}-nip`, categoryId: category.id, key: "nip", label: "NIP", publicVisible: false },
    { ...fields[2], id: `${category.id}-inactive`, categoryId: category.id, key: "inactiveField", label: "Kolom Nonaktif", publicVisible: true, active: false },
    { ...fields[2], id: `${category.id}-deleted`, categoryId: category.id, key: "deletedField", label: "Kolom Arsip", publicVisible: true, deletedAt: "2026-10-17T00:00:00.000Z" },
  ]);
  const publicEmployees: UiEmployee[] = employees.slice(0, 25).map((employee, index) => ({ ...employee, data: {
    ...employee.data, position: index % 2 ? `JABATAN_PRIVAT_${pad(index + 1)}` : `Jabatan Publik ${pad(index + 1)}`,
    nip: `NIP_RAHASIA_${pad(index + 1)}`, inactiveField: `NONAKTIF_RAHASIA_${pad(index + 1)}`, deletedField: `ARSIP_RAHASIA_${pad(index + 1)}`,
  } }));
  await page.route("**/api/backend", async (route) => {
    const { action } = route.request().postDataJSON() as { action: string };
    const responses: Record<string, unknown> = { "settings.public": { portalMode: "PUBLIC" }, "categories.publicList": { items: publicCategories }, "fields.publicList": { items: publicFields }, "employees.publicList": { items: publicEmployees } };
    await route.fulfill({ status: action in responses ? 200 : 400, json: { ok: action in responses, data: responses[action] ?? {} } });
  });
}

const moreButton = (page: Page, id: string) => page.locator(`button[aria-controls="${id}"]`);

async function expandToLastPage(page: Page, rows: Locator, id: string) {
  await expect(rows).toHaveCount(10);
  const more = moreButton(page, id);
  await expect(more).toHaveAccessibleName("Tampilkan 10 lagi");
  await more.click();
  await expect(rows).toHaveCount(20);
  await more.click();
  await expect(rows).toHaveCount(25);
  await expect(more).toHaveCount(0);
}

test("public directory initially shows 10 rows, adds 10, and resets after search or category changes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockPublic(page);
  await page.goto("/");
  const table = page.getByRole("table", { name: "Direktori pegawai publik" });
  const rows = table.locator("tbody > tr");
  await expandToLastPage(page, rows, "public-employee-records");
  await page.getByLabel("Cari direktori publik").fill("Pegawai");
  await expect(rows).toHaveCount(10);
  await moreButton(page, "public-employee-records").click();
  await expect(rows).toHaveCount(20);
  await page.getByLabel("Filter kategori publik").selectOption(categories[0].id);
  await expect(rows).toHaveCount(10);
  await moreButton(page, "public-employee-records").click();
  await expect(rows).toHaveCount(13);
  await expect(moreButton(page, "public-employee-records")).toHaveCount(0);
  await page.getByLabel("Filter kategori publik").selectOption("all");
  await expect(rows).toHaveCount(10);
  await page.getByLabel("Cari direktori publik").fill("Tidak ada pegawai ini");
  await expect(rows).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Data tidak ditemukan" })).toBeVisible();
  await expect(moreButton(page, "public-employee-records")).toHaveCount(0);
  await page.getByLabel("Cari direktori publik").fill("");
  await expect(rows).toHaveCount(10);
  expect(errors).toEqual([]);
});

test("public directory never renders or searches private, inactive, archived, or other-category field values", async ({ page }) => {
  await mockPublic(page);
  await page.goto("/");
  const table = page.getByRole("table", { name: "Direktori pegawai publik" });
  await expandToLastPage(page, table.locator("tbody > tr"), "public-employee-records");
  await expect(table).not.toContainText(/NIP_RAHASIA|NONAKTIF_RAHASIA|ARSIP_RAHASIA|JABATAN_PRIVAT/);
  await expect(table.getByRole("columnheader", { name: /NIP|Kolom Nonaktif|Kolom Arsip/ })).toHaveCount(0);
  await expect(table.getByRole("row").filter({ hasText: "Pegawai 01" })).toContainText("Jabatan Publik 01");
  await expect(table.getByRole("row").filter({ hasText: "Pegawai 02" })).not.toContainText("JABATAN_PRIVAT_02");
  for (const secret of ["NIP_RAHASIA_01", "NONAKTIF_RAHASIA_01", "ARSIP_RAHASIA_01", "JABATAN_PRIVAT_02"]) {
    await page.getByLabel("Cari direktori publik").fill(secret);
    await expect(page.getByRole("heading", { name: "Data tidak ditemukan" })).toBeVisible();
    await expect(table).toHaveCount(0);
  }
  await page.getByLabel("Cari direktori publik").fill("Jabatan Publik 25");
  await expect(table.locator("tbody > tr")).toHaveCount(1);
  await expect(table).toContainText("Pegawai 25");
});

test("employee table expands in tens and resets when search, category, or status changes", async ({ page }) => {
  const unexpected = await mockDashboard(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Data Pegawai", exact: true }).click();
  const rows = page.locator("#employee-records tbody > tr");
  await expandToLastPage(page, rows, "employee-records");
  const search = page.getByPlaceholder("Cari nama, NIP, atau jabatan");
  await search.fill("Pegawai");
  await expect(rows).toHaveCount(10);
  await moreButton(page, "employee-records").click();
  await expect(rows).toHaveCount(20);
  await page.getByLabel("Filter kategori", { exact: true }).selectOption(categories[0].id);
  await expect(rows).toHaveCount(10);
  await moreButton(page, "employee-records").click();
  await expect(rows).toHaveCount(13);
  await page.getByLabel("Filter kategori", { exact: true }).selectOption("all");
  await expect(rows).toHaveCount(10);
  await search.fill("");
  await moreButton(page, "employee-records").click();
  await page.getByLabel("Filter status").selectOption("inactive");
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText("Arsip 01");
  await expandToLastPage(page, rows, "employee-records");
  await page.getByLabel("Filter status").selectOption("active");
  await expect(rows).toHaveCount(10);
  await search.fill("Tidak ada pegawai ini");
  await expect(rows).toHaveCount(0);
  await expect(moreButton(page, "employee-records")).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("account lists expand in tens and switching tabs starts each list at 10", async ({ page }) => {
  const unexpected = await mockDashboard(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Kelola Akun", exact: true }).click();
  const records = page.locator("#account-records > article");
  await expandToLastPage(page, records, "account-records");
  await page.getByRole("button", { name: /^Akun Portal/ }).click();
  await expect(records.first()).toContainText("Portal 01");
  await expandToLastPage(page, records, "account-records");
  await page.getByRole("button", { name: /^Admin Kominfo/ }).click();
  await expect(records).toHaveCount(10);
  expect(unexpected).toEqual([]);
});

test("Excel export includes every employee while the table only displays its first 10 rows", async ({ page }) => {
  const unexpected = await mockDashboard(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Data Pegawai", exact: true }).click();
  const rows = page.locator("#employee-records tbody > tr");
  await expect(rows).toHaveCount(10);
  await expect(rows.filter({ hasText: "Pegawai 25" })).toHaveCount(0);
  await page.getByRole("button", { name: "Unduh data", exact: true }).click();
  await page.getByRole("radio", { name: /^Excel Spreadsheet/ }).check();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/^data-kepegawaian-\d{4}-\d{2}-\d{2}\.xls$/);
  expect(await download.failure()).toBeNull();
  const workbook = await readFile((await download.path())!, "utf8");
  const exportedNames = [...workbook.matchAll(/<Data ss:Type="String">((?:Pegawai|Arsip) \d+)<\/Data>/g)].map((match) => match[1]);
  expect(exportedNames).toHaveLength(employees.length);
  expect(exportedNames).toEqual(expect.arrayContaining(employees.map((employee) => employee.data.name)));
  expect(exportedNames).toContain("Pegawai 25");
  expect(exportedNames).toContain("Arsip 25");
  await expect(rows).toHaveCount(10);
  expect(unexpected).toEqual([]);
});

test("category and field lists expand independently and changing category resets its field list", async ({ page }) => {
  const unexpected = await mockDashboard(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Kategori & Kolom", exact: true }).click();
  const categoryRecords = page.locator("#category-records > article");
  const fieldRecords = page.locator("#field-records > article");
  await expect(categoryRecords).toHaveCount(10);
  await expandToLastPage(page, fieldRecords, "field-records");
  await expect(categoryRecords).toHaveCount(10);
  await expandToLastPage(page, categoryRecords, "category-records");
  await expect(fieldRecords).toHaveCount(25);
  await categoryRecords.locator(".category-list__main").filter({ hasText: "Kategori 02" }).click();
  await expect(fieldRecords).toHaveCount(10);
  await expect(categoryRecords).toHaveCount(25);
  await expandToLastPage(page, fieldRecords, "field-records");
  await categoryRecords.locator(".category-list__main").filter({ hasText: "Kategori 03" }).click();
  await expect(fieldRecords).toHaveCount(0);
  await expect(moreButton(page, "field-records")).toHaveCount(0);
  await categoryRecords.locator(".category-list__main").filter({ hasText: "Kategori 01" }).click();
  await expect(fieldRecords).toHaveCount(10);
  await expect(categoryRecords).toHaveCount(25);
  expect(unexpected).toEqual([]);
});

test("recent activity and audit lists expand in tens and audit search resets its list", async ({ page }) => {
  const unexpected = await mockDashboard(page);
  await page.goto("/dashboard");
  await expandToLastPage(page, page.locator("#recent-records > div"), "recent-records");
  await page.getByRole("button", { name: "Aktivitas", exact: true }).click();
  const records = page.locator("#audit-records > article");
  await expandToLastPage(page, records, "audit-records");
  await page.getByPlaceholder("Cari aktivitas").fill("employees");
  await expect(records).toHaveCount(10);
  await moreButton(page, "audit-records").click();
  await expect(records).toHaveCount(20);
  await page.getByPlaceholder("Cari aktivitas").fill("employees.create");
  await expect(records).toHaveCount(10);
  await moreButton(page, "audit-records").click();
  await expect(records).toHaveCount(13);
  await expect(moreButton(page, "audit-records")).toHaveCount(0);
  await page.getByPlaceholder("Cari aktivitas").fill("Tidak ada aktivitas ini");
  await expect(records).toHaveCount(0);
  await expect(moreButton(page, "audit-records")).toHaveCount(0);
  await page.getByPlaceholder("Cari aktivitas").fill("");
  await expect(records).toHaveCount(10);
  expect(unexpected).toEqual([]);
});

test("public directory remains a real table without page overflow on compact mobile in both themes", async ({ page }) => {
  await mockPublic(page);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const table = page.getByRole("table", { name: "Direktori pegawai publik" });
    await expect(table.locator("tbody > tr")).toHaveCount(10);
    for (const theme of ["light", "dark"]) {
      if (await page.locator("html").getAttribute("data-theme") !== theme) await page.getByRole("button", { name: theme === "dark" ? "Aktifkan tema gelap" : "Aktifkan tema terang" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(table).toHaveCSS("display", "table");
      await expect(table.locator("tbody")).toHaveCSS("display", "table-row-group");
      await expect(table.locator("tbody > tr").first()).toHaveCSS("display", "table-row");
      await expect(table.locator("tbody > tr").first().locator("td").first()).toHaveCSS("display", "table-cell");
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      expect(fits, `Public directory page overflowed at ${width}px in ${theme} theme`).toBe(true);
      await expect(moreButton(page, "public-employee-records")).toBeVisible();
    }
    await moreButton(page, "public-employee-records").click();
    await expect(table.locator("tbody > tr")).toHaveCount(20);
  }
});

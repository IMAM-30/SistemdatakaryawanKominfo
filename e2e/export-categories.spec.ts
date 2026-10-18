import { expect, test, type Download, type Locator, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";

const actor = { accountId: "export-admin", username: "adminexport", displayName: "Admin Ekspor", role: "KOMINFO_ADMIN" };
const categories = [
  { id: "export-pns", code: "PNS", name: "Pegawai Negeri Sipil", active: true, version: 1 },
  { id: "export-pppk", code: "PPPK", name: "Pegawai Pemerintah dengan Perjanjian Kerja", active: true, version: 1 },
  { id: "export-non", code: "NON_PNS", name: "Pegawai Non-ASN", active: true, version: 1 },
];
const labels = ["PNS", "PPPK", "Non-ASN"];
const fields = categories.map((category) => ({
  id: `${category.id}-name`, categoryId: category.id, key: "name", label: "Nama lengkap", type: "text",
  required: true, tableVisible: true, publicVisible: true, portalVisible: true, adminVisible: true,
  sortOrder: 1, active: true, system: true, version: 1,
}));
const employees = categories.flatMap((category, index) => Array.from({ length: 12 }, (_, row) => ({
  id: `${category.id}-${row + 1}`, categoryId: category.id,
  data: { name: `${labels[index]} Pegawai ${String(row + 1).padStart(2, "0")}` }, active: true, version: 1,
})));
const snapshot = {
  categories, fields,
  employees: [...employees,
    { id: "export-inactive", categoryId: categories[0].id, data: { name: "PNS Tidak Aktif" }, active: false, version: 1 },
    { id: "export-archived", categoryId: categories[0].id, data: { name: "PNS Sudah Diarsipkan" }, active: false, version: 1, deletedAt: "2026-10-01T00:00:00.000Z" },
  ],
};

async function mockExportDashboard(page: Page, onExport?: (route: Route) => Promise<void>) {
  const exports: Record<string, unknown>[] = [];
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ok: true, data: { actor } } }));
  await page.route("**/api/backend", async (route) => {
    const { action, payload } = route.request().postDataJSON() as { action: string; payload: Record<string, unknown> };
    if (action === "export.snapshot") {
      exports.push(payload);
      if (onExport) return onExport(route);
      return route.fulfill({ json: { ok: true, data: snapshot } });
    }
    if (action === "dashboard.snapshot") {
      return route.fulfill({ json: { ok: true, data: { ...snapshot, admins: [], portals: [], audit: [], settings: {} } } });
    }
    return route.fulfill({ status: 400, json: { ok: false, error: { code: "UNEXPECTED_ACTION", message: `Unexpected action: ${action}` } } });
  });
  return exports;
}

async function openEmployees(page: Page) {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Ringkasan", exact: true })).toBeVisible();
  const navigation = page.getByRole("button", { name: "Buka navigasi", exact: true });
  if (await navigation.isVisible()) await navigation.click();
  await page.getByRole("button", { name: "Data Pegawai", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Data Pegawai", exact: true })).toBeVisible();
}

async function openExport(page: Page) {
  await page.getByRole("button", { name: "Unduh data", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Unduh data pegawai", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectCategories(dialog: Locator, selected: string[]) {
  const group = dialog.getByRole("group", { name: "Kategori data", exact: true });
  await group.getByRole("checkbox", { name: "Semua kategori", exact: true }).uncheck();
  for (const label of selected) await group.getByRole("checkbox", { name: label, exact: true }).check();
  return group;
}

async function readDownload(download: Download) {
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).toBeTruthy();
  return (await readFile(path!)).toString("latin1");
}

const combinations = [["PNS"], ["PPPK"], ["Non-ASN"], ["PNS", "PPPK"], ["PNS", "Non-ASN"], ["PPPK", "Non-ASN"], labels];

for (const selected of combinations) {
  test(`category exports contain exactly ${selected.join(" + ")} in both Excel and PDF`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const requests = await mockExportDashboard(page);
    await openEmployees(page);
    await expect(page.locator("#employee-records tbody tr")).toHaveCount(10);
    const dialog = await openExport(page);
    const group = dialog.getByRole("group", { name: "Kategori data", exact: true });
    for (const label of ["Semua kategori", ...labels]) await expect(group.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
    if (selected.length < categories.length) await selectCategories(dialog, selected);
    await dialog.getByRole("radio", { name: /^Excel \+ PDF / }).check();
    const downloads: Download[] = [];
    page.on("download", (download) => downloads.push(download));
    await dialog.getByRole("button", { name: "Unduh", exact: true }).click();
    await expect.poll(() => downloads.length).toBe(2);
    expect(downloads.map((download) => download.suggestedFilename().split(".").at(-1)).sort()).toEqual(["pdf", "xls"]);
    for (const download of downloads) {
      const content = await readDownload(download);
      const isPdf = download.suggestedFilename().endsWith(".pdf");
      expect(content).toMatch(isPdf ? /^%PDF-/ : /^<\?xml version=/);
      for (const label of labels) {
        const heading = isPdf ? `Data Kepegawaian - ${label}` : `<Worksheet ss:Name="${label}">`;
        if (selected.includes(label)) {
          expect(content).toContain(heading);
          for (let row = 1; row <= 12; row++) expect(content).toContain(`${label} Pegawai ${String(row).padStart(2, "0")}`);
        } else {
          expect(content).not.toContain(heading);
          expect(content).not.toContain(`${label} Pegawai`);
        }
      }
      expect(content).not.toContain("PNS Sudah Diarsipkan");
      if (selected.includes("PNS")) expect(content).toContain("PNS Tidak Aktif");
      if (selected.length === categories.length) expect(download.suggestedFilename()).toMatch(/^data-kepegawaian-\d{4}-\d{2}-\d{2}\.(xls|pdf)$/);
      if (isPdf) expect(content).toMatch(/[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ re\s+S(?:\s|$)/);
    }
    expect(requests).toHaveLength(1);
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test("export category selection is independent of table search and category filters", async ({ page }) => {
  await mockExportDashboard(page);
  await openEmployees(page);
  await page.getByLabel("Filter kategori", { exact: true }).selectOption(categories[0].id);
  await page.getByPlaceholder("Cari nama, NIP, atau jabatan", { exact: true }).fill("PNS Pegawai 12");
  await expect(page.locator("#employee-records tbody tr")).toHaveCount(1);
  const dialog = await openExport(page);
  const group = dialog.getByRole("group", { name: "Kategori data", exact: true });
  await expect(group.getByRole("checkbox", { name: "Semua kategori", exact: true })).toBeChecked();
  await selectCategories(dialog, ["PPPK"]);
  const downloaded = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Unduh", exact: true }).click();
  const content = await readDownload(await downloaded);
  expect(content).toContain("PPPK Pegawai 01");
  expect(content).toContain("PPPK Pegawai 12");
  expect(content).not.toContain("PNS Pegawai");
  expect(content).not.toContain("Non-ASN Pegawai");
  await expect(page.getByLabel("Filter kategori", { exact: true })).toHaveValue(categories[0].id);
  await expect(page.getByPlaceholder("Cari nama, NIP, atau jabatan", { exact: true })).toHaveValue("PNS Pegawai 12");
});

test("empty category selection blocks download and selecting all restores all categories", async ({ page }) => {
  const requests = await mockExportDashboard(page);
  await openEmployees(page);
  const dialog = await openExport(page);
  const group = await selectCategories(dialog, []);
  await expect(dialog.getByRole("button", { name: "Unduh", exact: true })).toBeDisabled();
  for (const label of labels) await expect(group.getByRole("checkbox", { name: label, exact: true })).not.toBeChecked();
  await group.getByRole("checkbox", { name: "PNS", exact: true }).check();
  await expect(dialog.getByRole("button", { name: "Unduh", exact: true })).toBeEnabled();
  await expect(group.getByRole("checkbox", { name: "Semua kategori", exact: true })).toBeChecked({ indeterminate: true });
  await group.getByRole("checkbox", { name: "Semua kategori", exact: true }).check();
  for (const label of labels) await expect(group.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  expect(requests).toHaveLength(0);
});

test("pending exports lock controls and a failed request preserves categories and format for retry", async ({ page }) => {
  let releaseFailure!: () => void;
  const failureGate = new Promise<void>((resolve) => { releaseFailure = resolve; });
  let attempts = 0;
  await mockExportDashboard(page, async (route) => {
    if (++attempts === 1) {
      await failureGate;
      return route.fulfill({ status: 504, json: { ok: false, error: { code: "BACKEND_TIMEOUT", message: "Layanan ekspor belum merespons." } } });
    }
    return route.fulfill({ json: { ok: true, data: snapshot } });
  });
  await openEmployees(page);
  const dialog = await openExport(page);
  const group = await selectCategories(dialog, ["PPPK", "Non-ASN"]);
  await dialog.getByRole("radio", { name: /^PDF / }).check();
  await dialog.getByRole("button", { name: "Unduh", exact: true }).click();
  await expect.poll(() => attempts).toBe(1);
  for (const control of await dialog.getByRole("checkbox").all()) await expect(control).toBeDisabled();
  for (const control of await dialog.getByRole("radio").all()) await expect(control).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Batal", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Tutup", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Menyiapkan…", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  releaseFailure();
  await expect(dialog.getByRole("button", { name: "Unduh", exact: true })).toBeEnabled();
  await expect(page.getByText("Layanan ekspor belum merespons.", { exact: true }).first()).toBeVisible();
  await expect(group.getByRole("checkbox", { name: "PNS", exact: true })).not.toBeChecked();
  for (const label of ["PPPK", "Non-ASN"]) await expect(group.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: /^PDF / })).toBeChecked();
  const downloaded = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Unduh", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const content = await readDownload(download);
  expect(content).toContain("PPPK Pegawai 12");
  expect(content).toContain("Non-ASN Pegawai 12");
  expect(content).not.toContain("PNS Pegawai");
  expect(attempts).toBe(2);
});

test("an empty category catalog explains why export is unavailable", async ({ page }) => {
  const requests = await mockExportDashboard(page);
  await page.route("**/api/backend", async (route) => {
    const { action } = route.request().postDataJSON() as { action: string };
    if (action !== "dashboard.snapshot") return route.fallback();
    return route.fulfill({ json: { ok: true, data: { categories: [], fields: [], employees: [], admins: [], portals: [], audit: [], settings: {} } } });
  });
  await openEmployees(page);
  const dialog = await openExport(page);
  await expect(dialog.getByText("Belum ada kategori yang dapat diunduh.", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Semua kategori", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Unduh", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  expect(requests).toHaveLength(0);
});

test("export choices and actions remain reachable at 320, 480 and desktop in both themes", async ({ page }, testInfo) => {
  await mockExportDashboard(page);
  for (const width of [320, 480, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    await openEmployees(page);
    for (const theme of ["light", "dark"]) {
      if (await page.locator("html").getAttribute("data-theme") !== theme) await page.getByRole("button", { name: /Aktifkan tema (gelap|terang)/ }).click();
      const dialog = await openExport(page);
      const group = await selectCategories(dialog, ["PNS", "Non-ASN"]);
      for (const label of ["Semua kategori", ...labels]) await expect(group.getByRole("checkbox", { name: label, exact: true })).toBeVisible();
      const download = dialog.getByRole("button", { name: "Unduh", exact: true });
      await download.scrollIntoViewIfNeeded();
      await expect(download).toBeInViewport();
      const dimensions = await dialog.evaluate((element) => ({
        documentWidth: document.documentElement.scrollWidth, viewport: window.innerWidth,
        left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right,
        contentWidth: element.scrollWidth, visibleWidth: element.clientWidth,
      }));
      expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.left).toBeGreaterThanOrEqual(0);
      expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.visibleWidth + 1);
      await page.screenshot({ path: testInfo.outputPath(`export-${width}-${theme}.png`), fullPage: true });
      await dialog.getByRole("button", { name: "Batal", exact: true }).click();
    }
  }
});

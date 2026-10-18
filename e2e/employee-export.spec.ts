import { expect, test, type Download, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { UiField } from "../src/lib/ui-model";

const categories = [
  { id: "individual-pns", code: "PNS", name: "Pegawai Negeri Sipil", active: true, version: 1 },
  { id: "individual-pppk", code: "PPPK", name: "Pegawai Pemerintah dengan Perjanjian Kerja", active: true, version: 1 },
  { id: "individual-non", code: "NON_PNS", name: "Pegawai Non-ASN", active: true, version: 1 },
];
const definitions: Array<Pick<UiField, "key" | "label" | "type">> = [
  { key: "photo", label: "Foto pegawai", type: "photo" },
  { key: "name", label: "Nama lengkap", type: "text" },
  { key: "nip", label: "NIP", type: "text" },
  { key: "position", label: "Jabatan", type: "text" },
  { key: "addressCity", label: "Alamat domisili", type: "textarea" },
  { key: "serviceYears", label: "Masa kerja tahun", type: "number" },
  { key: "serviceMonths", label: "Masa kerja bulan", type: "number" },
  { key: "lastEducation", label: "Pendidikan terakhir", type: "text" },
  { key: "training", label: "Sudah pelatihan", type: "boolean" },
  { key: "phone", label: "Nomor telepon", type: "text" },
  ...Array.from({ length: 24 }, (_, index) => ({ key: `extra${index + 1}`, label: `Informasi ${String(index + 1).padStart(2, "0")}`, type: "text" as const })),
  { key: "notes", label: "Catatan lengkap", type: "textarea" },
];
const fields = categories.flatMap((category) => [
  ...definitions.map((definition, index) => ({
    ...definition, id: `${category.id}-${definition.key}`, categoryId: category.id, required: false,
    tableVisible: ["name", "nip", "position"].includes(definition.key), publicVisible: false,
    portalVisible: true, adminVisible: true, sortOrder: index, active: true, system: false, version: 1,
  })),
  { id: `${category.id}-inactive`, categoryId: category.id, key: "inactiveField", label: "Kolom nonaktif", type: "text" as const, required: false, tableVisible: false, publicVisible: false, portalVisible: true, adminVisible: true, sortOrder: 99, active: false, system: false, version: 1 },
  { id: `${category.id}-hidden`, categoryId: category.id, key: "hiddenField", label: "Kolom tersembunyi admin", type: "text" as const, required: false, tableVisible: false, publicVisible: false, portalVisible: false, adminVisible: false, sortOrder: 100, active: true, system: false, version: 1 },
  { id: `${category.id}-deleted`, categoryId: category.id, key: "deletedField", label: "Kolom terhapus", type: "text" as const, required: false, tableVisible: false, publicVisible: false, portalVisible: false, adminVisible: true, sortOrder: 101, active: true, system: false, version: 1, deletedAt: "2026-10-01T00:00:00.000Z" },
]);
const names = ["Aisyah Rahma", "Fajar Akbar", "Dina Putri"];
const employees = categories.map((category, index) => ({
  id: `individual-employee-${index}`, categoryId: category.id, active: index !== 1, version: 1,
  photoFileId: index === 0 ? "individual-photo" : undefined,
  data: {
    name: names[index], nip: `19900101202012200${index + 1}`, position: "Pengelola Data",
    addressCity: "Jalan Andi Makkasau, Kecamatan Ujung, Kota Parepare", serviceYears: 0, serviceMonths: 7,
    lastEducation: "Sarjana Informatika", training: false, phone: "", inactiveField: "RAHASIA_KOLOM_NONAKTIF",
    hiddenField: "RAHASIA_KOLOM_ADMIN", deletedField: "RAHASIA_KOLOM_TERHAPUS",
    ...Object.fromEntries(Array.from({ length: 24 }, (_, row) => [`extra${row + 1}`, `Lengkap${index + 1}Item${String(row + 1).padStart(2, "0")}`])),
    notes: ["AWALCATATAN", ...Array.from({ length: 95 }, (_, row) => `Riwayat kepegawaian ${row + 1}: penugasan dan pengembangan kompetensi.`), "AKHIRCATATAN"].join("\n"),
  },
}));
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGz8AAAAASUVORK5CYII=";

async function mockEmployees(page: Page, options: { role?: "MASTER_ADMIN" | "KOMINFO_ADMIN" | "PORTAL"; failedPhoto?: boolean; photoGate?: Promise<void> } = {}) {
  const actions: string[] = [];
  const actor = { accountId: "individual-admin", username: "adminindividual", displayName: "Admin Individu", role: options.role ?? "KOMINFO_ADMIN" };
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ok: true, data: { actor } } }));
  await page.route("**/api/backend", async (route) => {
    const { action } = route.request().postDataJSON() as { action: string };
    actions.push(action);
    if (action === "dashboard.snapshot") return route.fulfill({ json: { ok: true, data: { categories, fields, employees, admins: [], portals: [], audit: [], settings: {} } } });
    if (action === "files.get") {
      if (options.photoGate) await options.photoGate;
      if (options.failedPhoto) return route.fulfill({ status: 404, json: { ok: false, error: { code: "FILE_NOT_FOUND", message: "Foto tidak tersedia." } } });
      return route.fulfill({ json: { ok: true, data: { mimeType: "image/png", base64: png } } });
    }
    return route.fulfill({ status: 400, json: { ok: false, error: { code: "UNEXPECTED_ACTION", message: `Unexpected action: ${action}` } } });
  });
  return actions;
}

async function openEmployees(page: Page) {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Ringkasan", exact: true })).toBeVisible();
  const navigation = page.getByRole("button", { name: "Buka navigasi", exact: true });
  if (await navigation.isVisible()) await navigation.click();
  await page.getByRole("button", { name: "Data Pegawai", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Data Pegawai", exact: true })).toBeVisible();
}

async function openDetail(page: Page, name = names[0]) {
  await page.getByRole("combobox", { name: "Filter status", exact: true }).selectOption("all");
  await page.locator("#employee-records tbody tr").filter({ hasText: name }).getByTitle("Lihat detail", { exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Detail pegawai", exact: true });
  await expect(detail).toBeVisible();
  return detail;
}

async function openIndividualExport(page: Page, detail: Locator) {
  await detail.getByRole("button", { name: "Unduh data pegawai", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Unduh data pegawai ini", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function readDownload(download: Download) {
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).toBeTruthy();
  return readFile(path!);
}

for (const [index, category] of categories.entries()) {
  test(`individual ${category.code} downloads contain one complete employee in Excel and a readable multipage PDF`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const actions = await mockEmployees(page);
    await openEmployees(page);
    await expect(page.locator("#employee-records").getByText("Informasi 24", { exact: true })).toHaveCount(0);
    const detail = await openDetail(page, names[index]);
    for (const label of ["Kolom nonaktif", "Kolom tersembunyi admin", "Kolom terhapus"]) await expect(detail.getByText(label, { exact: true })).toHaveCount(0);
    for (const value of ["RAHASIA_KOLOM_NONAKTIF", "RAHASIA_KOLOM_ADMIN", "RAHASIA_KOLOM_TERHAPUS"]) await expect(detail.getByText(value, { exact: true })).toHaveCount(0);
    const dialog = await openIndividualExport(page, detail);
    await expect(dialog.getByRole("checkbox")).toHaveCount(0);
    await dialog.getByRole("radio", { name: /^Excel \+ PDF / }).check();
    const downloads: Download[] = [];
    page.on("download", (download) => downloads.push(download));
    await dialog.getByRole("button", { name: "Unduh", exact: true }).click();
    await expect.poll(() => downloads.length).toBe(2);
    expect(downloads.map((item) => item.suggestedFilename().split(".").at(-1)).sort()).toEqual(["pdf", "xls"]);
    for (const download of downloads) {
      const content = await readDownload(download);
      await download.saveAs(testInfo.outputPath(download.suggestedFilename()));
      if (download.suggestedFilename().endsWith(".xls")) {
        const xml = content.toString("utf8");
        const workbook = await page.evaluate((source) => {
          const document = new DOMParser().parseFromString(source, "application/xml");
          return {
            errors: document.querySelectorAll("parsererror").length,
            sheets: document.querySelectorAll("Worksheet").length,
            tables: document.querySelectorAll("Table").length,
            rows: [...document.querySelectorAll("Row")].map((row) => [...row.querySelectorAll("Data")].map((cell) => ({ value: cell.textContent, type: cell.getAttribute("ss:Type") }))),
          };
        }, xml);
        expect(workbook).toMatchObject({ errors: 0, sheets: 1, tables: 1 });
        expect(workbook.rows).toHaveLength(2);
        const values = Object.fromEntries(workbook.rows[0].map((cell, column) => [cell.value!, workbook.rows[1][column]]));
        expect(values["Nama lengkap"].value).toBe(names[index]);
        expect(values.NIP).toEqual({ value: employees[index].data.nip, type: "String" });
        expect(values["Masa kerja tahun"]).toEqual({ value: "0", type: "Number" });
        expect(values["Sudah pelatihan"]).toEqual({ value: "false", type: "Boolean" });
        expect(values["Nomor telepon"].value).toBe("");
        expect(values.Status.value).toBe(employees[index].active ? "Aktif" : "Tidak aktif");
        for (const field of definitions.filter((item) => item.type !== "photo")) expect(values[field.label]).toBeDefined();
        expect(values["Catatan lengkap"].value).toBe(employees[index].data.notes);
        for (const other of names.filter((name) => name !== names[index])) expect(xml).not.toContain(other);
        for (const excluded of ["Kolom nonaktif", "Kolom tersembunyi admin", "Kolom terhapus", "RAHASIA_KOLOM_NONAKTIF", "RAHASIA_KOLOM_ADMIN", "RAHASIA_KOLOM_TERHAPUS"]) expect(xml).not.toContain(excluded);
      } else {
        const pdf = content.toString("latin1");
        expect(pdf).toMatch(/^%PDF-/);
        expect(pdf.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
        expect(pdf).toContain(names[index]);
        expect(pdf).toContain(employees[index].data.nip);
        for (const field of definitions.filter((item) => item.type !== "photo")) expect(pdf).toContain(field.label);
        for (let row = 1; row <= 24; row++) expect(pdf).toContain(`Lengkap${index + 1}Item${String(row).padStart(2, "0")}`);
        expect(pdf).toContain("AWALCATATAN");
        expect(pdf).toContain("AKHIRCATATAN");
        expect(pdf).not.toMatch(/[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ re\s+(?:S|B|b)(?:\s|$)/);
        for (const other of names.filter((name) => name !== names[index])) expect(pdf).not.toContain(other);
        for (const excluded of ["Kolom nonaktif", "Kolom tersembunyi admin", "Kolom terhapus", "RAHASIA_KOLOM_NONAKTIF", "RAHASIA_KOLOM_ADMIN", "RAHASIA_KOLOM_TERHAPUS"]) expect(pdf).not.toContain(excluded);
      }
    }
    await expect(dialog).toBeHidden();
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("button", { name: "Unduh data pegawai", exact: true })).toBeFocused();
    expect(actions).not.toContain("export.snapshot");
    expect(errors).toEqual([]);
  });
}

test("individual download is inside the full detail and nested cancel or Escape preserves detail and focus", async ({ page }) => {
  const actions = await mockEmployees(page, { role: "MASTER_ADMIN" });
  await openEmployees(page);
  await expect(page.getByRole("button", { name: "Unduh data", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unduh data pegawai", exact: true })).toHaveCount(0);
  await expect(page.locator("#employee-records").getByRole("button", { name: /Unduh/ })).toHaveCount(0);
  const detail = await openDetail(page);
  for (const method of ["cancel", "escape"]) {
    const dialog = await openIndividualExport(page, detail);
    if (method === "cancel") await dialog.getByRole("button", { name: "Batal", exact: true }).click();
    else await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("button", { name: "Unduh data pegawai", exact: true })).toBeFocused();
    expect(await page.locator("body").evaluate((element) => element.style.overflow)).toBe("hidden");
  }
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(page.locator("#employee-records tbody tr").filter({ hasText: names[0] }).getByTitle("Lihat detail", { exact: true })).toBeFocused();
  expect(await page.locator("body").evaluate((element) => element.style.overflow)).not.toBe("hidden");
  expect(actions).not.toContain("export.snapshot");
});

test("a missing employee photo does not block a complete PDF download", async ({ page }) => {
  const actions = await mockEmployees(page, { failedPhoto: true });
  await openEmployees(page);
  const detail = await openDetail(page);
  const dialog = await openIndividualExport(page, detail);
  await dialog.getByRole("radio", { name: /^PDF / }).check();
  const downloaded = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Unduh", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const pdf = (await readDownload(download)).toString("latin1");
  expect(pdf).toContain(names[0]);
  expect(pdf).toContain("Lengkap1Item24");
  expect(pdf).toContain("AKHIRCATATAN");
  await expect(dialog).toBeHidden();
  await expect(detail).toBeVisible();
  expect(actions).toContain("files.get");
  expect(actions).not.toContain("export.snapshot");
});

test("a failed individual file creation keeps the chosen format available for retry", async ({ page }) => {
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    let rejectOnce = true;
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof Blob && object.type.startsWith("application/vnd.ms-excel") && rejectOnce) {
        rejectOnce = false;
        throw new Error("Unduhan uji belum tersedia.");
      }
      return original(object);
    };
  });
  const actions = await mockEmployees(page);
  await openEmployees(page);
  const detail = await openDetail(page);
  const dialog = await openIndividualExport(page, detail);
  await dialog.getByRole("radio", { name: /^Excel / }).first().check();
  await dialog.getByRole("button", { name: "Unduh", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Unduhan uji belum tersedia.");
  await expect(dialog.getByRole("radio", { name: /^Excel / }).first()).toBeChecked();
  await expect(dialog.getByRole("button", { name: "Unduh", exact: true })).toBeEnabled();
  const downloaded = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Unduh", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.xls$/);
  expect((await readDownload(download)).toString("utf8")).toContain(names[0]);
  await expect(dialog).toBeHidden();
  await expect(detail).toBeVisible();
  expect(actions).not.toContain("export.snapshot");
});

test("pending individual PDF generation locks nested controls and Escape until the photo is ready", async ({ page }) => {
  let releasePhoto!: () => void;
  const photoGate = new Promise<void>((resolve) => { releasePhoto = resolve; });
  await mockEmployees(page, { photoGate });
  await openEmployees(page);
  const detail = await openDetail(page);
  const dialog = await openIndividualExport(page, detail);
  await expect(dialog.getByRole("radio", { name: /^PDF / })).toBeChecked();
  const downloaded = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Unduh", exact: true }).click();
  for (const radio of await dialog.getByRole("radio").all()) await expect(radio).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Batal", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Tutup", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Menyiapkan…", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  releasePhoto();
  expect((await readDownload(await downloaded)).toString("latin1")).toContain(names[0]);
  await expect(dialog).toBeHidden();
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("button", { name: "Unduh data pegawai", exact: true })).toBeFocused();
});

test("individual Excel download finishes even while the employee photo is still loading", async ({ page }) => {
  let releasePhoto!: () => void;
  const photoGate = new Promise<void>((resolve) => { releasePhoto = resolve; });
  await mockEmployees(page, { photoGate });
  await openEmployees(page);
  const detail = await openDetail(page);
  const dialog = await openIndividualExport(page, detail);
  await dialog.getByRole("radio", { name: /^Excel / }).first().check();
  const downloaded = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Unduh", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.xls$/);
  expect((await readDownload(download)).toString("utf8")).toContain("Lengkap1Item24");
  await expect(dialog).toBeHidden();
  await expect(detail).toBeVisible();
  releasePhoto();
});

test("Portal users retain read-only detail without export controls", async ({ page }) => {
  const actions = await mockEmployees(page, { role: "PORTAL" });
  await openEmployees(page);
  await expect(page.getByRole("button", { name: "Unduh data", exact: true })).toHaveCount(0);
  const detail = await openDetail(page);
  await expect(detail.getByRole("heading", { name: names[0], exact: true })).toBeVisible();
  await expect(detail.getByRole("button", { name: "Unduh data pegawai", exact: true })).toHaveCount(0);
  expect(actions).not.toContain("export.snapshot");
});

test("detail download and category download remain noticeable and reachable on mobile and desktop in both themes", async ({ page }, testInfo) => {
  await mockEmployees(page);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    await openEmployees(page);
    for (const theme of ["light", "dark"]) {
      if (await page.locator("html").getAttribute("data-theme") !== theme) await page.getByRole("button", { name: /Aktifkan tema (gelap|terang)/ }).click();
      const categoryDownload = page.getByRole("button", { name: "Unduh data", exact: true });
      await categoryDownload.scrollIntoViewIfNeeded();
      await expect(categoryDownload).toBeInViewport();
      const categorySize = await categoryDownload.boundingBox();
      expect(categorySize?.width).toBeGreaterThan(100);
      expect(categorySize?.height).toBeGreaterThanOrEqual(40);
      await page.screenshot({ path: testInfo.outputPath(`employee-download-button-${width}-${theme}.png`) });
      const detail = await openDetail(page);
      const individualDownload = detail.getByRole("button", { name: "Unduh data pegawai", exact: true });
      await individualDownload.scrollIntoViewIfNeeded();
      await expect(individualDownload).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`employee-detail-${width}-${theme}.png`) });
      const dialog = await openIndividualExport(page, detail);
      const submit = dialog.getByRole("button", { name: "Unduh", exact: true });
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      for (const radio of await dialog.getByRole("radio").all()) await expect(radio).toBeVisible();
      const dimensions = await dialog.evaluate((element) => ({
        documentWidth: document.documentElement.scrollWidth, viewport: window.innerWidth,
        left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right,
        contentWidth: element.scrollWidth, visibleWidth: element.clientWidth,
      }));
      expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.left).toBeGreaterThanOrEqual(0);
      expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.visibleWidth + 1);
      await page.screenshot({ path: testInfo.outputPath(`employee-export-${width}-${theme}.png`) });
      await dialog.getByRole("button", { name: "Batal", exact: true }).click();
      await detail.getByRole("button", { name: "Tutup", exact: true }).first().click();
    }
  }
});

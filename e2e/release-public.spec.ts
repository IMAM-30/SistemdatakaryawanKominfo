import { expect, test, type Page } from "@playwright/test";
import type { UiCategory, UiEmployee, UiField } from "../src/lib/ui-model";

const categories: UiCategory[] = [
  { id: "public-category", code: "PNS", name: "Kategori Publik", active: true },
  { id: "inactive-category", code: "HIDDEN", name: "Kategori Nonaktif", active: false },
  { id: "deleted-category", code: "ARCHIVE", name: "Kategori Arsip", active: true, deletedAt: "2026-10-18T00:00:00.000Z" },
];
const fields: UiField[] = categories.flatMap((category) => ["name", "position"].map((key, index) => ({
  id: `${category.id}-${key}`, categoryId: category.id, key, label: key === "name" ? "Nama" : "Jabatan",
  type: "text", required: false, active: true, system: true, tableVisible: true, publicVisible: true,
  portalVisible: true, adminVisible: true, sortOrder: index, version: 1,
})));
fields.push({ ...fields[0], id: "hidden-category-field", categoryId: "inactive-category", key: "internalUnit", label: "Unit kategori nonaktif" });
const employees: UiEmployee[] = categories.map((category, index) => ({
  id: `employee-${index}`, categoryId: category.id, active: true, version: 1,
  data: { name: `Pegawai ${category.name}`, position: "Pengelola data" },
}));
employees.push({ ...employees[0], id: "orphan-employee", categoryId: "missing-category", data: { name: "Pegawai Kategori Hilang" } });

async function mockDirectory(page: Page, beforeData?: () => Promise<void>) {
  await page.route("**/api/backend", async (route) => {
    const { action } = route.request().postDataJSON() as { action: string };
    if (action !== "settings.public") await beforeData?.();
    const results: Record<string, unknown> = {
      "settings.public": { portalMode: "PUBLIC" }, "categories.publicList": { items: categories },
      "fields.publicList": { items: fields }, "employees.publicList": { items: employees },
    };
    await route.fulfill({ json: { ok: true, data: results[action] } });
  });
}

test("public directory keeps its loading state until all directory data has arrived", async ({ page }) => {
  let releaseData!: () => void;
  const dataGate = new Promise<void>((resolve) => { releaseData = resolve; });
  await mockDirectory(page, () => dataGate);
  const dataRequested = page.waitForRequest((request) => request.url().endsWith("/api/backend") && request.postDataJSON().action === "employees.publicList");
  await page.goto("/");
  await dataRequested;
  try {
    await expect(page.getByRole("heading", { name: "Memeriksa akses portal" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Data tidak ditemukan" })).toHaveCount(0);
    await expect(page.getByLabel("Cari direktori publik")).toHaveCount(0);
  } finally { releaseData(); }
  await expect(page.getByRole("table", { name: "Direktori pegawai publik" })).toContainText("Pegawai Kategori Publik");
  await expect(page.getByRole("heading", { name: "Memeriksa akses portal" })).toHaveCount(0);
});

test("public directory excludes employees and fields from inactive, archived, or missing categories", async ({ page }) => {
  await mockDirectory(page);
  await page.goto("/");
  const table = page.getByRole("table", { name: "Direktori pegawai publik" });
  await expect(table.locator("tbody > tr")).toHaveCount(1);
  await expect(table).toContainText("Pegawai Kategori Publik");
  await expect(table).not.toContainText(/Kategori Nonaktif|Kategori Arsip/);
  await expect(table.getByRole("columnheader", { name: "Unit kategori nonaktif" })).toHaveCount(0);
  await expect(page.getByLabel("Filter kategori publik").locator("option")).toHaveCount(2);
  for (const hiddenName of ["Kategori Nonaktif", "Kategori Arsip", "Kategori Hilang"]) {
    await page.getByLabel("Cari direktori publik").fill(hiddenName);
    await expect(page.getByRole("heading", { name: "Data tidak ditemukan" })).toBeVisible();
  }
});

for (const mode of ["LOGIN_REQUIRED", "CLOSED"] as const) {
  test(`public directory does not request employee data when access is ${mode}`, async ({ page }) => {
    const actions: string[] = [];
    await page.route("**/api/backend", async (route) => {
      actions.push(route.request().postDataJSON().action);
      await route.fulfill({ json: { ok: true, data: { portalMode: mode } } });
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: mode === "CLOSED" ? "Direktori publik sedang ditutup" : "Portal memerlukan login" })).toBeVisible();
    expect(actions).toEqual(["settings.public"]);
    await expect(page.getByLabel("Cari direktori publik")).toHaveCount(0);
  });
}

test("public directory reports a failed data request without presenting an empty result", async ({ page }) => {
  await page.route("**/api/backend", async (route) => {
    const { action } = route.request().postDataJSON();
    await route.fulfill(action === "settings.public"
      ? { json: { ok: true, data: { portalMode: "PUBLIC" } } }
      : { status: 503, json: { ok: false, error: { code: "UNAVAILABLE", message: "Layanan data belum tersedia." } } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Direktori publik sedang ditutup" })).toBeVisible();
  await expect(page.getByText("Layanan data belum tersedia.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data tidak ditemukan" })).toHaveCount(0);
});

for (const area of ["admin", "portal"] as const) {
  test(`${area} login and theme controls work when the browser denies preference storage`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage is disabled", "SecurityError"); } });
    });
    const actor = { accountId: "storage-test", username: "pengguna", displayName: "Pengguna Uji", role: area === "admin" ? "MASTER_ADMIN" : "PORTAL" };
    await page.route("**/api/auth/login", (route) => route.fulfill({ json: { ok: true, data: { actor, csrfToken: "test", expiresInSeconds: 3600 } } }));
    await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ok: true, data: { actor } } }));
    await page.route("**/api/backend", async (route) => {
      const { action } = route.request().postDataJSON();
      const results: Record<string, unknown> = { "categories.list": { items: [categories[0]] }, "fields.list": { items: fields.slice(0, 2) }, "employees.list": { items: [employees[0]] }, "settings.get": { PORTAL_MODE: "PUBLIC" } };
      await route.fulfill({ json: { ok: true, data: results[action] ?? { items: [] } } });
    });
    await page.goto(area === "admin" ? "/admin" : "/login");
    await expect(page.getByRole("heading", { name: area === "admin" ? "Masuk ke Ruang Admin" : "Masuk ke Portal" })).toBeVisible();
    await page.getByRole("button", { name: "Aktifkan tema gelap" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByLabel("ID pengguna", { exact: true }).fill("pengguna");
    await page.getByLabel("Password", { exact: true }).fill("PasswordUji!234");
    await page.getByRole("button", { name: "Masuk ke sistem", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Ringkasan", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("refreshed employee avatars follow cached replacements, removals, and ignore stale photo requests", async ({ page }) => {
  const actor = { accountId: "photo-test", username: "portal", displayName: "Portal Pengujian", role: "PORTAL" };
  const photoA = "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  const photoB = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  let currentPhoto: string | undefined = "photo-a";
  let releasePhoto!: () => void;
  const photoGate = new Promise<void>((resolve) => { releasePhoto = resolve; });
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ok: true, data: { actor } } }));
  await page.route("**/api/backend", async (route) => {
    const { action, payload } = route.request().postDataJSON();
    if (action === "files.get") {
      if (payload.id === "photo-slow") await photoGate;
      await route.fulfill({ json: { ok: true, data: { mimeType: "image/gif", base64: payload.id === "photo-a" ? photoA : photoB } } });
      return;
    }
    const results: Record<string, unknown> = {
      "categories.list": { items: [categories[0]] }, "fields.list": { items: fields.slice(0, 2) },
      "employees.list": { items: [{ ...employees[0], photoFileId: currentPhoto }, { ...employees[0], id: "second-employee", photoFileId: "photo-b" }] },
    };
    await route.fulfill({ json: { ok: true, data: results[action] } });
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Data Pegawai", exact: true }).click();
  const avatars = page.locator("#employee-records tbody > tr .avatar");
  const first = avatars.nth(0);
  await expect(first.locator("img")).toHaveAttribute("src", `data:image/gif;base64,${photoA}`);
  await expect(avatars.nth(1).locator("img")).toHaveAttribute("src", `data:image/gif;base64,${photoB}`);
  const refresh = async (photo: string | undefined) => {
    currentPhoto = photo;
    const response = page.waitForResponse((result) => result.url().endsWith("/api/backend") && result.request().postDataJSON().action === "employees.list");
    await page.getByRole("button", { name: "Sinkronkan data", exact: true }).click();
    await response;
    await expect(page.getByRole("button", { name: "Sinkronkan data", exact: true })).toBeEnabled();
  };
  await refresh("photo-b");
  await expect(first.locator("img")).toHaveAttribute("src", `data:image/gif;base64,${photoB}`);
  await refresh(undefined);
  await expect(first.locator("img")).toHaveCount(0);
  await expect(first).toHaveText("P");
  const slowRequested = page.waitForRequest((request) => request.url().endsWith("/api/backend") && request.postDataJSON().payload?.id === "photo-slow");
  await refresh("photo-slow");
  await slowRequested;
  const slowResponse = page.waitForResponse((response) => response.url().endsWith("/api/backend") && response.request().postDataJSON().payload?.id === "photo-slow");
  try {
    await expect(first.locator("img")).toHaveCount(0);
    await refresh("photo-a");
    await expect(first.locator("img")).toHaveAttribute("src", `data:image/gif;base64,${photoA}`);
  } finally { releasePhoto(); }
  await (await slowResponse).finished();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(first.locator("img")).toHaveAttribute("src", `data:image/gif;base64,${photoA}`);
});

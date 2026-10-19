import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const actor = {
  accountId: "account-master",
  username: "masterkominfo",
  displayName: "Admin Master Kominfo",
  role: "MASTER_ADMIN",
};

const categories = [
  { id: "category-pns", code: "PNS", name: "Pegawai Negeri Sipil", active: true, version: 1 },
  { id: "category-pppk", code: "PPPK", name: "Pegawai Pemerintah dengan Perjanjian Kerja", active: true, version: 1 },
  { id: "category-non", code: "NON_PNS", name: "Pegawai Non-ASN", active: true, version: 1 },
];

const fields = [
  { id: "field-photo", categoryId: "category-pns", key: "photo", label: "Foto", type: "photo", required: false, tableVisible: false, publicVisible: true, portalVisible: true, adminVisible: true, sortOrder: 0, active: true, system: true, version: 1 },
  { id: "field-name", categoryId: "category-pns", key: "name", label: "Nama Lengkap", type: "text", required: true, tableVisible: true, publicVisible: true, portalVisible: true, adminVisible: true, sortOrder: 1, active: true, system: true, version: 1 },
  { id: "field-nip", categoryId: "category-pns", key: "nip", label: "NIP", type: "text", required: true, tableVisible: true, publicVisible: false, portalVisible: true, adminVisible: true, sortOrder: 2, active: true, system: true, version: 1 },
  { id: "field-birth-date", categoryId: "category-pns", key: "birthDate", label: "Tanggal Lahir", type: "date", required: false, tableVisible: false, publicVisible: true, portalVisible: true, adminVisible: true, sortOrder: 2.5, active: true, system: true, version: 1 },
  { id: "field-position", categoryId: "category-pns", key: "position", label: "Jabatan", type: "text", required: false, tableVisible: true, publicVisible: true, portalVisible: true, adminVisible: true, sortOrder: 3, active: true, system: false, version: 1 },
  { id: "field-pppk-name", categoryId: "category-pppk", key: "name", label: "Nama", type: "text", required: true, tableVisible: true, publicVisible: true, portalVisible: true, adminVisible: true, sortOrder: 1, active: true, system: true, version: 1 },
  { id: "field-pppk-nip", categoryId: "category-pppk", key: "nip", label: "NIP", type: "text", required: true, tableVisible: true, publicVisible: false, portalVisible: true, adminVisible: true, sortOrder: 2, active: true, system: true, version: 1 },
];

const employees = [
  { id: "employee-1", categoryId: "category-pns", data: { name: "Aisyah Rahma", nip: "199001012020122001", birthDate: "1990-12-03", position: "Pranata Humas" }, photoFileId: "photo-1", active: true, version: 1 },
  { id: "employee-2", categoryId: "category-pppk", data: { name: "Fajar Akbar", position: "Pengelola Sistem" }, active: true, version: 1 },
  { id: "employee-archive", categoryId: "category-pns", data: { name: "Rahma Arsip", nip: "198812122010012001" }, active: false, version: 2, deletedAt: "2026-09-29T00:00:00.000Z" },
];

const audit = [{
  id: "audit-1",
  actorId: actor.accountId,
  actorRole: actor.role,
  actorUsername: actor.username,
  actorDisplayName: actor.displayName,
  action: "employees.update",
  entityType: "EMPLOYEE",
  entityId: "employee-1",
  summary: {
    entityName: "Aisyah Rahma",
    changes: [{ field: "position", label: "Jabatan", before: "Staf", after: "Pranata Humas" }],
  },
  createdAt: "2026-10-19T02:00:00.000Z",
}];

async function mockDashboard(page: Page, actions: string[] = [], requests: Array<{ action: string; payload: Record<string, unknown> }> = []) {
  let currentActor: typeof actor & { profilePhotoFileId?: string } = { ...actor };
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ok: true, data: { actor: currentActor } } }));
  await page.route("**/api/backend", async (route) => {
    const { action, payload = {} } = route.request().postDataJSON() as { action: string; payload?: Record<string, unknown> };
    actions.push(action);
    requests.push({ action, payload });
    if (action === "accounts.updateOwnProfilePhoto") currentActor = { ...currentActor, profilePhotoFileId: String(payload.profilePhotoFileId) };
    const data: Record<string, unknown> = {
      "dashboard.snapshot": { categories, fields, employees, admins: [], portals: [{ id: "portal-1", username: "portalpegawai", displayName: "Portal Pegawai", role: "PORTAL", active: true, version: 1 }], audit, settings: { PORTAL_MODE: "LOGIN_REQUIRED" } },
      "files.get": { mimeType: "image/gif", base64: "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" },
      "files.upload": { id: "profile-photo-new" },
      "export.snapshot": { categories, fields, employees },
      "employees.restore": { ...employees[2], deletedAt: "", active: true, version: 3 },
    };
    await route.fulfill({ json: { ok: true, data: data[action] ?? {} } });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    fits: document.documentElement.scrollWidth <= window.innerWidth + 1,
    viewport: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => ({ tag: element.tagName.toLowerCase(), className: element.className, right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) }))
      .filter((item) => item.right > window.innerWidth + 1 || item.width > window.innerWidth + 1)
      .slice(0, 6),
  }));
  expect(layout, `Horizontal overflow detected: ${JSON.stringify(layout)}`).toMatchObject({ fits: true });
}

async function mockPublicPortal(page: Page) {
  await page.route("**/api/backend", async (route) => {
    const { action } = route.request().postDataJSON() as { action: string };
    const data: Record<string, unknown> = {
      "settings.public": { portalMode: "PUBLIC" },
      "categories.publicList": { items: categories },
      "fields.publicList": { items: fields.filter((field) => field.publicVisible) },
      "employees.publicList": { items: employees.filter((employee) => !employee.deletedAt) },
      "files.publicGet": { mimeType: "image/gif", base64: "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" },
    };
    await route.fulfill({ json: { ok: true, data: data[action] ?? {} } });
  });
}

test("public landing and login follow the Kominfo design language", async ({ page }) => {
  await mockPublicPortal(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Data kepegawaian yang tertata/i })).toBeVisible();
  await expect(page.getByAltText("Lambang Kota Parepare")).toBeVisible();
  await expect(page.getByRole("table", { name: "Direktori pegawai publik" }).getByText("Aisyah Rahma", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Masuk ke sistem/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Masuk ke Portal" })).toBeVisible();
  await expect(page.getByText("Portal Pegawai", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Masuk ke Ruang Admin" })).toBeVisible();
  await expect(page.getByText("Akses khusus Admin Kominfo dan Admin Master.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Aktifkan tema gelap" }).click();
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("dark");
});

test("archived employees can be restored and exports download as Excel", async ({ page }) => {
  const actions: string[] = [];
  await mockDashboard(page, actions);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Data Pegawai" }).click();
  await page.getByLabel("Filter status").selectOption("inactive");
  await expect(page.getByText("Rahma Arsip", { exact: true })).toBeVisible();
  await page.getByTitle("Pulihkan").click();
  await page.getByRole("button", { name: "Ya, pulihkan" }).click();
  await expect.poll(() => actions.includes("employees.restore")).toBe(true);

  await page.getByRole("button", { name: "Unduh data" }).click();
  await expect(page.getByRole("heading", { name: "Unduh data pegawai" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh", exact: true }).click();
  await expect((await download).suggestedFilename()).toMatch(/data-kepegawaian-\d{4}-\d{2}-\d{2}\.xls/);
  await expect.poll(() => actions.includes("export.snapshot")).toBe(true);
});

test("PDF exports download directly with stroked table borders", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockDashboard(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Data Pegawai" }).click();
  await page.getByRole("button", { name: "Unduh data" }).click();
  await page.getByRole("radio", { name: /^PDF / }).check();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/^data-kepegawaian-\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(await download.failure()).toBeNull();
  const content = (await readFile((await download.path())!)).toString("latin1");
  expect(content).toMatch(/^%PDF-/);
  const borders = content.match(/[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ re\s+S(?:\s|$)/g) ?? [];
  const expectedBorders = categories.reduce((total, category) => {
    const columns = fields.filter((field) => field.categoryId === category.id && field.active && field.type !== "photo").length + 2;
    const rows = employees.filter((employee) => employee.categoryId === category.id && !employee.deletedAt).length;
    return total + columns * (rows + 1);
  }, 0);
  expect(borders).toHaveLength(expectedBorders);
  expect(content).toContain("Aisyah Rahma");
  expect(content).toContain("Fajar Akbar");
  await expect(page.getByRole("heading", { name: "Unduh data pegawai" })).toBeHidden();
  expect(errors).toEqual([]);
});

test("account password reset and category editing call the protected backend actions", async ({ page }) => {
  const actions: string[] = [];
  await mockDashboard(page, actions);
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Kelola Akun" }).click();
  await page.getByRole("button", { name: /Akun Portal/ }).click();
  await page.getByRole("button", { name: "Opsi akun portalpegawai" }).click();
  await page.getByRole("button", { name: "Reset password" }).click();
  await page.getByLabel("Password baru", { exact: true }).fill("PasswordBaru!234");
  await page.getByLabel("Konfirmasi password").fill("PasswordBaru!234");
  await page.getByRole("button", { name: "Lanjutkan reset" }).click();
  await page.getByRole("button", { name: "Ya, reset" }).click();
  await expect.poll(() => actions.includes("accounts.resetPortalPassword")).toBe(true);

  await page.getByRole("button", { name: "Kategori & Kolom" }).click();
  await page.getByTitle("Edit kategori").first().click();
  await page.getByLabel("Nama kategori").fill("PNS Pemerintah Kota");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await page.getByRole("button", { name: "Ya, simpan" }).click();
  await expect.poll(() => actions.includes("categories.update")).toBe(true);
});

test("dashboard loads real workspace states and navigates to employee data", async ({ page }) => {
  await mockDashboard(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Ringkasan" })).toBeVisible();
  await expect(page.getByText("Admin Master Kominfo", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("2", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Data Pegawai" }).click();
  await expect(page.getByRole("heading", { name: "Data Pegawai" })).toBeVisible();
  await expect(page.getByText("Aisyah Rahma", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Nama", exact: true })).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: "Aisyah Rahma" }).locator(".avatar img")).toBeVisible();
  await expect(page.getByRole("button", { name: /Tambah pegawai/i })).toBeVisible();
  await page.getByLabel("Filter kategori").selectOption("category-pppk");
  const pppkRow = page.getByRole("row").filter({ hasText: "Fajar Akbar" });
  await pppkRow.getByTitle("Edit").click();
  await expect(page.getByLabel("NIP")).toBeVisible();
});

test("system activity explains who changed which value from before to after", async ({ page }) => {
  await mockDashboard(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Aktivitas", exact: true }).click();

  await expect(page.getByText("Data pegawai diperbarui", { exact: true })).toBeVisible();
  await expect(page.getByText("Aisyah Rahma", { exact: true })).toBeVisible();
  await expect(page.getByText("Admin Master Kominfo (@masterkominfo)", { exact: true })).toBeVisible();
  const change = page.locator(".audit-changes").getByText("Jabatan", { exact: true }).locator("..");
  await expect(change.getByText("Staf", { exact: true })).toBeVisible();
  await expect(change.getByText("Pranata Humas", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Cari aktivitas, data, atau username admin").fill("masterkominfo");
  await expect(page.locator(".audit-timeline article")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
});

test("existing dates use DD/MM/YYYY in detail and edit without changing the ISO storage contract", async ({ page }) => {
  const requests: Array<{ action: string; payload: Record<string, unknown> }> = [];
  await mockDashboard(page, [], requests);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Data Pegawai" }).click();
  const row = page.getByRole("row").filter({ hasText: "Aisyah Rahma" });
  await row.getByTitle("Lihat detail").click();
  await expect(page.getByRole("dialog", { name: "Detail pegawai" }).getByText("03/12/1990", { exact: true })).toBeVisible();
  await page.getByRole("dialog", { name: "Detail pegawai" }).getByRole("button", { name: "Edit data" }).click();
  const date = page.getByLabel("Tanggal Lahir");
  await expect(date).toHaveValue("03/12/1990");
  await date.fill("05/11/1991");
  await page.getByRole("button", { name: /Lanjut/ }).click();
  await page.getByRole("button", { name: /Simpan data/ }).click();
  await page.getByRole("button", { name: "Ya, simpan" }).click();
  await expect.poll(() => requests.find((request) => request.action === "employees.update")?.payload).toMatchObject({ data: { birthDate: "1991-11-05" } });
});

test("admin can replace the account profile photo from settings", async ({ page }) => {
  const actions: string[] = [];
  await mockDashboard(page, actions);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Pengaturan" }).click();
  await page.getByLabel("Pilih foto").setInputFiles({ name: "profil.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await page.getByRole("button", { name: "Simpan foto" }).click();
  await expect(page.getByText("Foto profil berhasil diperbarui.")).toBeVisible();
  await expect.poll(() => actions).toEqual(expect.arrayContaining(["files.upload", "accounts.updateOwnProfilePhoto"]));
  await expect(page.locator(".topbar-account .avatar img")).toHaveAttribute("src", /^data:image\/gif;base64,/);
});

test("employee detail highlights its category and supports readable text and fullscreen photo", async ({ page }) => {
  await mockDashboard(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Aktifkan tema gelap" }).click();
  await page.getByRole("button", { name: "Data Pegawai" }).click();
  const row = page.getByRole("row").filter({ hasText: "Aisyah Rahma" });
  await row.getByTitle("Lihat detail").click();

  const detail = page.getByRole("dialog", { name: "Detail pegawai" });
  await expect(detail.getByText("PNS", { exact: true })).toBeVisible();
  await expect(detail.getByText("Pegawai Negeri Sipil", { exact: true })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "Data Pribadi" })).toHaveCSS("color", "rgb(89, 170, 189)");
  await detail.getByRole("button", { name: "Perbesar teks detail" }).click();
  await expect(detail.locator(".employee-detail")).toHaveAttribute("data-text-size", "large");

  await detail.getByRole("button", { name: "Perbesar foto Aisyah Rahma" }).click();
  const lightbox = page.getByRole("dialog", { name: "Foto Aisyah Rahma" });
  await expect(lightbox).toBeVisible();
  await lightbox.click();
  await expect(lightbox).toBeHidden();
});

test("mobile layouts do not overflow and dashboard navigation stays usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Masuk ke Portal" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await mockDashboard(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Ringkasan" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Buka navigasi" }).click();
  await expect(page.getByRole("navigation", { name: "Navigasi dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "Data Pegawai" }).click();
  await expect(page.getByRole("heading", { name: "Data Pegawai" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("UI 2.0 remains stable across compact mobile, tablet, laptop, and desktop in both themes", async ({ page }) => {
  const viewports = [
    { width: 320, height: 700 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ];

  await mockPublicPortal(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Data kepegawaian yang tertata/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Masuk ke Portal" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const themeToggle = page.getByRole("button", { name: /Aktifkan tema (gelap|terang)/ });
    await expect(themeToggle).toBeVisible();
    await themeToggle.click();
    await expectNoHorizontalOverflow(page);
  }

  await page.unroute("**/api/backend");
  await mockDashboard(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Ringkasan" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SessionActor } from "../src/lib/domain/types";
import type { UiAccount, UiAudit, UiCategory, UiEmployee, UiField } from "../src/lib/ui-model";

const longName = "Nur Aisyah Rahmawati Andi Muhammad Fachruddin, S.Kom., M.Si.";
const longToken = "DirektoratPengelolaanInformasiKomunikasiPublikDanStatistikSektoral";
const actor: SessionActor = { accountId: "ultimate-master", username: "admin.pengujian.responsif", displayName: longName, role: "MASTER_ADMIN" };
const categories: UiCategory[] = [
  { id: "pns", code: "PNS", name: "Pegawai Negeri Sipil Pemerintah Kota Parepare", active: true, version: 1 },
  { id: "pppk", code: "PPPK", name: "Pegawai Pemerintah dengan Perjanjian Kerja Pemerintah Kota Parepare", active: true, version: 1 },
  { id: "non", code: "NON_PNS", name: longToken, active: true, version: 1 },
];
const fieldDefinitions: Array<{ key: string; label: string; type: UiField["type"]; required?: boolean }> = [
  { key: "name", label: "Nama lengkap dan gelar pegawai", type: "text", required: true },
  { key: "nip", label: "Nomor Induk Pegawai", type: "text", required: true },
  { key: "photo", label: "Foto", type: "photo" },
  { key: "latestRank", label: "Pangkat dan golongan terakhir", type: "text" },
  { key: "position", label: "Jabatan dan penempatan pada unit organisasi", type: "text" },
  { key: "educationMajor", label: "Jurusan pendidikan terakhir", type: "text" },
  { key: longToken, label: "Keterangan tambahan untuk administrasi kepegawaian daerah", type: "textarea" },
];
const fields: UiField[] = categories.flatMap((category) => fieldDefinitions.map((field, index) => ({
  ...field, id: `${category.id}-${field.key}`, categoryId: category.id, required: Boolean(field.required),
  tableVisible: field.type !== "photo", publicVisible: field.key !== "nip", portalVisible: true,
  adminVisible: true, sortOrder: index, active: true, system: ["name", "nip", "photo"].includes(field.key), version: 1,
})));
const employees: UiEmployee[] = Array.from({ length: 13 }, (_, index) => ({
  id: `ultimate-employee-${index}`, categoryId: categories[index % categories.length].id, active: true, version: 1,
  data: { name: index ? `Pegawai ${index} ${longName}` : longName, nip: `1990010120201220${String(index).padStart(2, "0")}`,
    latestRank: "Penata Tingkat I (III/d)", position: longToken, educationMajor: "Teknik Informatika dan Sistem Informasi", [longToken]: longToken },
}));
const accounts = (role: "KOMINFO_ADMIN" | "PORTAL"): UiAccount[] => [{ id: `${role}-1`, username: `pengguna.${longToken.toLowerCase()}`, displayName: longName, role, active: true, version: 1 }];
const audit: UiAudit[] = [{ id: "ultimate-audit", actorId: actor.accountId, actorRole: actor.role, action: "employees.update", entityType: "employees", entityId: employees[0].id, summary: { name: longName, unit: longToken }, createdAt: "2026-10-18T10:00:00.000Z" }];

async function mockWorkspace(page: Page, sessionActor = actor) {
  const unexpected: string[] = [];
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ok: true, data: { actor: sessionActor } } }));
  await page.route("**/api/backend", async (route) => {
    const { action } = route.request().postDataJSON() as { action: string };
    const responses: Record<string, unknown> = {
      "settings.public": { portalMode: "PUBLIC" }, "categories.publicList": { items: categories },
      "fields.publicList": { items: fields.filter((field) => field.publicVisible) }, "employees.publicList": { items: employees },
      "categories.list": { items: categories }, "fields.list": { items: fields }, "employees.list": { items: employees },
      "accounts.listAdmins": { items: accounts("KOMINFO_ADMIN") }, "accounts.listPortal": { items: accounts("PORTAL") },
      "audit.list": { items: audit }, "settings.get": { PORTAL_MODE: "PUBLIC" }, "export.snapshot": { categories, fields, employees },
    };
    if (!(action in responses)) unexpected.push(action);
    await route.fulfill({ status: action in responses ? 200 : 400, json: { ok: action in responses, data: responses[action] ?? {}, error: { message: "Unexpected backend action in read-only UI test" } } });
  });
  return unexpected;
}

async function expectLayoutFits(page: Page, context: string, controls?: Locator) {
  const measurements = await page.evaluate(() => ({
    viewport: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
  }));
  expect(measurements.pageWidth, `${context}: page overflows ${JSON.stringify(measurements)}`).toBeLessThanOrEqual(measurements.viewport + 1);
  if (!controls) return;
  const outside = await controls.evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || getComputedStyle(element).visibility === "hidden") return [];
    return rect.left < -1 || rect.right > window.innerWidth + 1 ? [{ text: element.textContent?.trim().slice(0, 60), left: rect.left, right: rect.right }] : [];
  }));
  expect(outside, `${context}: usable controls must fit horizontally`).toEqual([]);
}

async function setTheme(page: Page, theme: "light" | "dark") {
  if (await page.locator("html").getAttribute("data-theme") !== theme) {
    await page.getByRole("button", { name: theme === "dark" ? "Aktifkan tema gelap" : "Aktifkan tema terang" }).click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function navigateDashboard(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Buka navigasi", exact: true });
  if (await menu.isVisible()) await menu.click();
  const navigation = page.getByRole("navigation", { name: "Navigasi dashboard" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("button", { name, exact: true }).click();
}

const authCases = [
  { area: "portal", path: "/login", heading: "Masuk ke Portal", role: "PORTAL" },
  { area: "admin", path: "/admin", heading: "Masuk ke Ruang Admin", role: "MASTER_ADMIN" },
] as const;

test("portal and admin use distinct login structures while retaining accessible credentials", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const item of authCases) {
    await page.goto(item.path);
    await expect(page.getByRole("heading", { name: item.heading })).toBeVisible();
    await expect(page.locator("main.login-page")).toHaveAttribute("data-login-area", item.area);
    await expect(page.locator(`.login-shell--${item.area}`)).toBeVisible();
    await expect(page.getByLabel("ID pengguna", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    if (item.area === "portal") await expect(page.locator(".login-photo > img")).toBeVisible();
    else await expect(page.locator(".login-photo, .login-visual")).toHaveCount(0);
  }
});

for (const item of authCases) {
  test(`${item.area} login preserves visibility toggle, pending, failure recovery, and the correct authentication area`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const unexpected = await mockWorkspace(page, { ...actor, role: item.role });
    const requests: Array<{ username: string; password: string; area: string }> = [];
    let failLogin: (() => void) | undefined;
    const failureGate = new Promise<void>((resolve) => { failLogin = resolve; });
    await page.route("**/api/auth/login", async (route) => {
      requests.push(route.request().postDataJSON());
      if (requests.length === 1) {
        await failureGate;
        await route.fulfill({ status: 401, json: { ok: false, error: { code: "INVALID_CREDENTIALS", message: "ID pengguna atau password salah." } } });
      } else {
        await route.fulfill({ json: { ok: true, data: { actor: { ...actor, role: item.role }, csrfToken: "test-csrf", expiresInSeconds: 3600 } } });
      }
    });
    await page.goto(item.path);
    await page.getByLabel("ID pengguna", { exact: true }).fill("pengguna.responsif");
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("PasswordUji!234");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Tampilkan password", exact: true }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Sembunyikan password", exact: true }).click();
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Masuk ke sistem", exact: true }).click();
    await expect(page.getByRole("button", { name: "Memverifikasi…" })).toBeDisabled();
    failLogin?.();
    await expect(page.locator(".login-auth").getByRole("alert")).toContainText("ID pengguna atau password salah.");
    const submit = page.getByRole("button", { name: "Masuk ke sistem", exact: true });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Ringkasan", exact: true })).toBeVisible();
    expect(requests).toEqual([
      { username: "pengguna.responsif", password: "PasswordUji!234", area: item.area },
      { username: "pengguna.responsif", password: "PasswordUji!234", area: item.area },
    ]);
    expect(await page.evaluate(() => localStorage.getItem("kominfo-login-area"))).toBe(item.area);
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("public and both login pages fit small phones, tablets, laptops, large screens, and short landscape", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const unexpected = await mockWorkspace(page);
  const viewports = [
    { width: 320, height: 700 }, { width: 390, height: 844 }, { width: 740, height: 1024 },
    { width: 820, height: 1180 }, { width: 900, height: 700 }, { width: 1024, height: 600 },
    { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 844, height: 390 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const directory = page.getByRole("table", { name: "Direktori pegawai publik" });
    await expect(directory.locator("tbody > tr")).toHaveCount(10);
    await expect(directory).toHaveCSS("display", "table");
    await expectLayoutFits(page, `Public ${viewport.width}×${viewport.height}`, page.locator(".public-header__actions, .public-directory__toolbar > *"));
    await directory.locator("tbody details").first().locator("summary").click();
    await expectLayoutFits(page, `Expanded public row ${viewport.width}`);
    if ([320, 820, 1920].includes(viewport.width)) {
      await setTheme(page, "dark");
      await expectLayoutFits(page, `Public dark ${viewport.width}`);
      await setTheme(page, "light");
    }
    for (const item of authCases) {
      await page.goto(item.path);
      await expect(page.getByRole("heading", { name: item.heading })).toBeVisible();
      const submit = page.getByRole("button", { name: "Masuk ke sistem", exact: true });
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      await expectLayoutFits(page, `${item.area} ${viewport.width}×${viewport.height}`, page.locator(".login-form .input-shell, .login-submit, .login-panel__top"));
      if ([320, 820].includes(viewport.width)) {
        await setTheme(page, "dark");
        await expectLayoutFits(page, `${item.area} dark ${viewport.width}`);
        await setTheme(page, "light");
      }
    }
  }
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("every dashboard panel remains usable with long dynamic data across responsive breakpoints", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const unexpected = await mockWorkspace(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Ringkasan", exact: true })).toBeVisible();
  for (const viewport of [
    { width: 320, height: 700 }, { width: 390, height: 844 }, { width: 740, height: 1024 },
    { width: 820, height: 1180 }, { width: 900, height: 700 }, { width: 1024, height: 600 },
    { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [navigation, heading] of [
      ["Ringkasan", "Ringkasan"], ["Data Pegawai", "Data Pegawai"], ["Kelola Akun", "Kelola Akun"],
      ["Kategori & Kolom", "Kategori & Kolom"], ["Aktivitas", "Aktivitas Sistem"], ["Pengaturan", "Pengaturan"],
    ]) {
      await navigateDashboard(page, navigation);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      const controls = page.locator(".dashboard-topbar > button, .dashboard-topbar__actions, .data-toolbar > *, .panel-tabs > button, .panel__header > button, .audit-toolbar > *, .refresh-button");
      await expectLayoutFits(page, `${navigation} ${viewport.width}×${viewport.height}`, controls);
      if ([320, 820].includes(viewport.width)) {
        await setTheme(page, "dark");
        await expectLayoutFits(page, `${navigation} dark ${viewport.width}`, controls);
        await setTheme(page, "light");
      }
    }
  }
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("dashboard search shortcut and mobile navigation preserve keyboard focus and release the page", async ({ page }) => {
  const unexpected = await mockWorkspace(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Ringkasan", exact: true })).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("textbox", { name: "Cari pegawai", exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.locator(".mobile-menu");
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  const navigation = page.getByRole("navigation", { name: "Navigasi dashboard" });
  await expect(navigation).toBeVisible();
  await expect(page.locator(".dashboard-main")).toHaveAttribute("inert", "");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".dashboard-sidebar")))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
  await expect(page.locator(".dashboard-main")).not.toHaveAttribute("inert", "");
  await menu.click();
  await navigation.getByRole("button", { name: "Data Pegawai", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Data Pegawai", exact: true })).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".dashboard-main")).not.toHaveAttribute("inert", "");
  expect(unexpected).toEqual([]);
});

test("employee detail, the edit wizard, account and download dialogs fit compact and short screens", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const unexpected = await mockWorkspace(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Ringkasan", exact: true })).toBeVisible();
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await navigateDashboard(page, "Data Pegawai");
    await page.getByTitle("Lihat detail", { exact: true }).first().click();
    const detail = page.getByRole("dialog", { name: "Detail pegawai", exact: true });
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: "Perbesar teks detail", exact: true }).click();
    await expectLayoutFits(page, `Detail ${viewport.width}`, detail.locator(".modal__header, .modal__actions, .detail-text-control"));
    await detail.getByRole("button", { name: "Edit data", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "Edit data pegawai", exact: true });
    await expect(edit).toBeVisible();
    for (let step = 0; step < 5; step += 1) {
      await expectLayoutFits(page, `Wizard step ${step} ${viewport.width}`, edit.locator(".modal__header, .modal__actions, .wizard__body .input, .wizard__body .textarea"));
      const next = edit.getByRole("button", { name: "Lanjut", exact: true });
      if (await next.count()) await next.click();
    }
    await edit.getByRole("button", { name: "Simpan data", exact: true }).scrollIntoViewIfNeeded();
    await expect(edit.getByRole("button", { name: "Simpan data", exact: true })).toBeInViewport();
    await edit.getByRole("button", { name: "Batal", exact: true }).click();
    await page.getByRole("button", { name: "Unduh data", exact: true }).click();
    const download = page.getByRole("dialog", { name: "Unduh data pegawai", exact: true });
    await expectLayoutFits(page, `Download ${viewport.width}`, download.locator(".modal__header, .modal__actions, .export-options > label"));
    await download.getByRole("button", { name: "Batal", exact: true }).click();
    await navigateDashboard(page, "Kelola Akun");
    await page.getByRole("button", { name: "Tambah akun", exact: true }).click();
    const account = page.getByRole("dialog", { name: "Tambah Admin Kominfo", exact: true });
    await expect(account).toBeVisible();
    await expectLayoutFits(page, `Account ${viewport.width}`, account.locator(".modal__header, .modal__actions, .simple-form .input"));
    await account.getByRole("button", { name: "Batal", exact: true }).click();
  }
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

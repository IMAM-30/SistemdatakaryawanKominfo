import { expect, test, type Page } from "@playwright/test";

async function mockWorkspace(page: Page) {
  const actor = { accountId: "release-master", username: "release", displayName: "Audit Release", role: "MASTER_ADMIN" };
  const categories = [{ id: "pns", code: "PNS", name: "PNS", active: true, version: 1 }];
  const fields = [{ id: "name", categoryId: "pns", key: "name", label: "Nama lengkap", type: "text", required: true, active: true, sortOrder: 0, tableVisible: true, publicVisible: true, portalVisible: true, adminVisible: true, system: true, version: 1 }];
  const employees = ["Andi", "Budi"].map((name, index) => ({ id: String(index), categoryId: "pns", data: { name }, active: true, version: 1 }));
  const mutations: string[] = [];
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ok: true, data: { actor } } }));
  await page.route("**/api/backend", (route) => {
    const { action, payload } = route.request().postDataJSON();
    if (action === "employees.create") {
      const employee = { id: "new", ...payload, version: 1 };
      mutations.push(action); employees.push(employee);
      return route.fulfill({ json: { ok: true, data: employee } });
    }
    const responses: Record<string, unknown> = {
      "categories.list": { items: categories }, "fields.list": { items: fields }, "employees.list": { items: employees },
      "accounts.listAdmins": { items: [] }, "accounts.listPortal": { items: [] }, "audit.list": { items: [] }, "settings.get": {},
    };
    return route.fulfill({ status: action in responses ? 200 : 400, json: { ok: action in responses, data: responses[action] } });
  });
  return mutations;
}

test("closed mobile navigation stays out of keyboard focus and reopens after desktop resize", async ({ page }) => {
  await mockWorkspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Ringkasan", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigasi dashboard" })).toBeHidden();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Buka navigasi", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Navigasi dashboard" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(".dashboard-main")).not.toHaveAttribute("inert", "");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.getByRole("navigation", { name: "Navigasi dashboard" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "Navigasi dashboard" })).toBeHidden();
});

test("repeated global searches update the employee filter including the same query after a local edit", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto("/dashboard");
  const globalSearch = page.getByRole("textbox", { name: "Cari pegawai", exact: true });
  await globalSearch.fill("Andi"); await globalSearch.press("Enter");
  const rows = page.locator("#employee-records tbody > tr");
  await expect(rows).toHaveCount(1); await expect(rows.first()).toContainText("Andi");
  await globalSearch.fill("Budi"); await globalSearch.press("Enter");
  await expect(rows).toHaveCount(1); await expect(rows.first()).toContainText("Budi");
  const localSearch = page.getByPlaceholder("Cari nama, NIP, atau jabatan");
  await localSearch.fill("Andi"); await expect(rows.first()).toContainText("Andi");
  await globalSearch.press("Enter");
  await expect(localSearch).toHaveValue("Budi"); await expect(rows.first()).toContainText("Budi");
  await globalSearch.fill(""); await globalSearch.press("Enter");
  await expect(rows).toHaveCount(2);
});

test("nested save confirmation keeps the draft on Escape, traps focus, and releases scrolling after save", async ({ page }) => {
  const mutations = await mockWorkspace(page);
  await page.goto("/dashboard");
  await page.getByRole("navigation", { name: "Navigasi dashboard" }).getByRole("button", { name: "Data Pegawai", exact: true }).click();
  const opener = page.getByRole("button", { name: "Tambah pegawai", exact: true });
  await opener.focus(); await opener.press("Enter");
  const form = page.getByRole("dialog", { name: "Tambah pegawai", exact: true });
  const name = form.getByRole("textbox", { name: /Nama lengkap/ });
  await name.fill("Pegawai Release");
  const saveButton = form.getByRole("button", { name: "Simpan data", exact: true });
  await saveButton.focus(); await saveButton.press("Enter");
  const confirmation = page.getByRole("dialog", { name: "Tambahkan data pegawai?", exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Ya, simpan", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(confirmation.getByRole("button", { name: "Tutup", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(form).toBeVisible(); await expect(name).toHaveValue("Pegawai Release");
  await expect(form.getByRole("button", { name: "Simpan data", exact: true })).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await saveButton.press("Enter");
  await confirmation.getByRole("button", { name: "Ya, simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(opener).toBeFocused();
  await expect(page.locator("#employee-records")).toContainText("Pegawai Release");
  expect(mutations).toEqual(["employees.create"]);
});

test("pending saves stay open and a failed mutation preserves the draft for one deliberate retry", async ({ page }) => {
  const mutations = await mockWorkspace(page);
  let attempts = 0;
  let failRequest: (() => void) | undefined;
  const failureGate = new Promise<void>((resolve) => { failRequest = resolve; });
  await page.route("**/api/backend", async (route) => {
    if (route.request().postDataJSON().action !== "employees.create") return route.fallback();
    attempts += 1;
    if (attempts > 1) return route.fallback();
    await failureGate;
    return route.fulfill({ status: 503, json: { ok: false, error: { code: "UNAVAILABLE", message: "Koneksi sedang terputus. Coba kembali." } } });
  });
  await page.goto("/dashboard");
  await page.getByRole("navigation", { name: "Navigasi dashboard" }).getByRole("button", { name: "Data Pegawai", exact: true }).click();
  await page.getByRole("button", { name: "Tambah pegawai", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Tambah pegawai", exact: true });
  await form.getByRole("textbox", { name: /Nama lengkap/ }).fill("Draft tersimpan");
  await form.getByRole("button", { name: "Simpan data", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Tambahkan data pegawai?", exact: true });
  await confirmation.getByRole("button", { name: "Ya, simpan", exact: true }).click();
  await expect(confirmation.getByRole("button", { name: "Memproses…", exact: true })).toBeDisabled();
  await expect(confirmation.getByRole("button", { name: "Tutup", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeVisible();
  failRequest?.();
  await expect(confirmation).toHaveCount(0);
  await expect(form).toContainText("Koneksi sedang terputus. Coba kembali.");
  await expect(form.getByRole("textbox", { name: /Nama lengkap/ })).toHaveValue("Draft tersimpan");
  await form.getByRole("button", { name: "Simpan data", exact: true }).click();
  await confirmation.getByRole("button", { name: "Ya, simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.locator("#employee-records")).toContainText("Draft tersimpan");
  expect(attempts).toBe(2);
  expect(mutations).toEqual(["employees.create"]);
});

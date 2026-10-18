import { expect, test, type Page } from "@playwright/test";

const actor = { accountId: "sync-master", username: "sync-test", displayName: "Pengujian sinkronisasi", role: "MASTER_ADMIN" };
const categories = [{ id: "pns", code: "PNS", name: "Pegawai Negeri Sipil", active: true, version: 1 }];
const employees = [{ id: "pegawai-1", categoryId: "pns", data: { name: "Data tersimpan" }, active: true, version: 1 }];

async function mockData(page: Page) {
  const state = { failedAction: "", failureStatus: 504, failureMessage: "Google Sheets belum merespons. Silakan coba kembali.", sessionStatus: 200, actions: [] as string[], pending: null as Promise<void> | null };
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: state.sessionStatus, json: state.sessionStatus === 200
    ? { ok: true, data: { actor } }
    : { ok: false, error: { code: "SESSION_BACKEND_ERROR", message: "Pemeriksaan sesi belum tersedia." } } }));
  await page.route("**/api/backend", async (route) => {
    const { action } = route.request().postDataJSON() as { action: string };
    state.actions.push(action);
    if (state.pending) await state.pending;
    if (action === state.failedAction) return route.fulfill({ status: state.failureStatus, json: { ok: false, error: { code: "BACKEND_ERROR", message: state.failureMessage } } });
    const responses: Record<string, unknown> = {
      "dashboard.snapshot": { categories, fields: [], employees, admins: [], portals: [], audit: [], settings: {} },
    };
    return route.fulfill({ status: action in responses ? 200 : 400, json: { ok: action in responses, data: responses[action] } });
  });
  return state;
}

test("a first-load timeout shows a retry instead of zero totals or a successful sync", async ({ page }) => {
  const state = await mockData(page);
  state.failedAction = "dashboard.snapshot";
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Data belum dapat dimuat", exact: true })).toBeVisible();
  await expect(page.locator(".stat-grid, .welcome-strip")).toHaveCount(0);
  await expect(page.getByText("Data terbaru sudah disinkronkan dari Google Sheets.", { exact: true })).toHaveCount(0);
  state.failedAction = "";
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ringkasan", exact: true })).toBeVisible();
  await expect(page.locator(".stat-card--primary strong")).toHaveText("1");
});

test("a failed refresh retains the last successful data and identifies it as older data", async ({ page }) => {
  const state = await mockData(page);
  await page.goto("/dashboard");
  await expect(page.locator(".stat-card--primary strong")).toHaveText("1");
  state.failedAction = "dashboard.snapshot";
  await page.getByRole("button", { name: "Sinkronkan data", exact: true }).click();
  await expect(page.locator(".page-error")).toHaveAttribute("role", "alert");
  await expect(page.locator(".page-error")).toContainText("Menampilkan data dari sinkronisasi terakhir yang berhasil.");
  await expect(page.locator(".stat-card--primary strong")).toHaveText("1");
  state.failedAction = "";
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.locator(".page-error")).toHaveCount(0);
  await expect(page.locator(".stat-card--primary strong")).toHaveText("1");
});

test("a snapshot error while reading settings is not silently converted into empty dashboard data", async ({ page }) => {
  const state = await mockData(page);
  state.failedAction = "dashboard.snapshot";
  state.failureStatus = 500;
  state.failureMessage = "Pengaturan belum dapat dimuat.";
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Data belum dapat dimuat", exact: true })).toBeVisible();
  await expect(page.locator(".dashboard-loading [role='alert']")).toContainText(state.failureMessage);
  await expect(page.locator(".stat-grid")).toHaveCount(0);
  state.failedAction = "";
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.locator(".stat-card--primary strong")).toHaveText("1");
});

test("a temporary session timeout can be retried without redirecting to login", async ({ page }) => {
  const state = await mockData(page);
  state.sessionStatus = 504;
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Koneksi belum tersedia", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  state.sessionStatus = 200;
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.locator(".stat-card--primary strong")).toHaveText("1");
});

test("an expired session still redirects to its login area", async ({ page }) => {
  const state = await mockData(page);
  state.sessionStatus = 401;
  await page.addInitScript(() => localStorage.setItem("kominfo-login-area", "admin"));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/admin$/);
});

test("each dashboard load uses one complete snapshot without separate data requests", async ({ page }) => {
  const state = await mockData(page);
  await page.goto("/dashboard");
  await expect(page.locator(".stat-card--primary strong")).toHaveText("1");
  expect(state.actions).toEqual(["dashboard.snapshot"]);
  const refreshed = page.waitForResponse((response) => response.url().endsWith("/api/backend") && response.request().postDataJSON().action === "dashboard.snapshot");
  await page.getByRole("button", { name: "Sinkronkan data", exact: true }).click();
  await refreshed;
  await expect(page.getByRole("button", { name: "Sinkronkan data", exact: true })).toBeEnabled();
  expect(state.actions).toEqual(["dashboard.snapshot", "dashboard.snapshot"]);
});

test("a pending snapshot keeps a loading state until a complete response arrives", async ({ page }) => {
  const state = await mockData(page);
  let resolveSnapshot!: () => void;
  state.pending = new Promise<void>((resolve) => { resolveSnapshot = resolve; });
  try {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Menyiapkan ruang kerja", exact: true })).toBeVisible();
    await expect(page.locator(".dashboard-loading")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".stat-grid, .welcome-strip")).toHaveCount(0);
    await expect.poll(() => state.actions).toEqual(["dashboard.snapshot"]);
  } finally { resolveSnapshot(); }
  await expect(page.getByRole("heading", { name: "Ringkasan", exact: true })).toBeVisible();
  await expect(page.locator(".stat-card--primary strong")).toHaveText("1");
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:3210" },
  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3210",
    url: "http://127.0.0.1:3210",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      APP_ENV: "test",
      APPS_SCRIPT_URL: "https://script.google.com/macros/s/test/exec",
      APPS_SCRIPT_HMAC_SECRET: "test-hmac-secret-with-at-least-32-characters",
      CREDENTIAL_ENCRYPTION_KEY: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc",
      BOOTSTRAP_SECRET: "test-bootstrap-secret-long-enough",
      SESSION_COOKIE_NAME: "kominfo_test_session",
    },
  },
});

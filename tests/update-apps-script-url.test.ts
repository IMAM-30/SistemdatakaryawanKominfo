import { describe, expect, it } from "vitest";
// @ts-expect-error Operational JavaScript module intentionally has no declaration file.
import { updateAppsScriptUrl } from "../scripts/update-apps-script-url.mjs";

describe("Apps Script URL updater", () => {
  it("updates only the deployment URL and preserves secrets byte-for-byte", () => {
    const before = [
      "APP_ENV=development",
      "APPS_SCRIPT_URL=https://script.google.com/macros/s/old-deployment/exec",
      "APPS_SCRIPT_HMAC_SECRET=keep-this-secret",
      "CREDENTIAL_ENCRYPTION_KEY=keep-this-key",
      "",
    ].join("\n");

    const after = updateAppsScriptUrl(before, "new-deployment");

    expect(after).toContain("APPS_SCRIPT_URL=https://script.google.com/macros/s/new-deployment/exec");
    expect(after).toContain("APPS_SCRIPT_HMAC_SECRET=keep-this-secret");
    expect(after).toContain("CREDENTIAL_ENCRYPTION_KEY=keep-this-key");
    expect(after.replace("new-deployment", "old-deployment")).toBe(before);
  });

  it("rejects malformed deployment IDs", () => {
    expect(() => updateAppsScriptUrl("APPS_SCRIPT_URL=x\n", "../unsafe")).toThrow("Invalid Apps Script deployment ID");
  });
});

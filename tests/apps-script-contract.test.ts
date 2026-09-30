import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const router = readFileSync(new URL("../apps-script/Router.gs", import.meta.url), "utf8");
const config = readFileSync(new URL("../apps-script/Config.gs", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../apps-script/appsscript.json", import.meta.url), "utf8"));

describe("Apps Script contract", () => {
  it.each([
    "health", "auth.lookup", "auth.bootstrapMaster", "settings.update", "categories.create", "fields.create",
    "employees.create", "files.upload", "accounts.createAdmin", "accounts.createPortal", "accounts.resetPortalPassword",
    "audit.list", "export.snapshot",
  ])("allowlists %s", (action) => expect(router).toContain(`'${action}'`));

  it("defines the audit, idempotency, session, and rate-limit system tables", () => {
    for (const table of ["AUDIT_LOGS", "IDEMPOTENCY", "SESSIONS", "RATE_LIMITS"]) expect(config).toContain(`${table}:`);
  });

  it("does not embed the supplied Google resource IDs in executable Apps Script", () => {
    expect(config).not.toContain("1W4JB2Bbyy3hkniZB6ioTm9kQcpsNRUKGBF2jfErin-w");
    expect(config).not.toContain("1AMvdH7KdDiRMdbqWg8k8Q_Veb9JaV-Ac");
  });

  it("deploys the Web App as its owner for HMAC-authenticated server calls", () => {
    expect(manifest.webapp).toEqual({
      access: "ANYONE_ANONYMOUS",
      executeAs: "USER_DEPLOYING",
    });
  });
});

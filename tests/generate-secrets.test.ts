import { describe, expect, it } from "vitest";
// @ts-expect-error Operational JavaScript module intentionally has no declaration file.
import { generateSecrets, renderEnvFile } from "../scripts/generate-secrets.mjs";

describe("Google backend secret generator", () => {
  it("generates production-length independent secrets", () => {
    const secrets = generateSecrets();
    expect(Buffer.from(secrets.hmacSecret, "base64url")).toHaveLength(32);
    expect(Buffer.from(secrets.encryptionKey, "base64url")).toHaveLength(32);
    expect(Buffer.from(secrets.bootstrapSecret, "base64url")).toHaveLength(32);
    expect(new Set(Object.values(secrets)).size).toBe(3);
  });

  it("renders server-only names and an /exec URL", () => {
    const value = renderEnvFile({ hmacSecret: "h", encryptionKey: "e", bootstrapSecret: "b" }, "deployment");
    expect(value).toContain("APPS_SCRIPT_URL=https://script.google.com/macros/s/deployment/exec");
    expect(value).not.toContain("NEXT_PUBLIC_");
  });
});

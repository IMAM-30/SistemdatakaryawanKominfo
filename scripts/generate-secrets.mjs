import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export function generateSecrets() {
  return {
    hmacSecret: randomBytes(32).toString("base64url"),
    encryptionKey: randomBytes(32).toString("base64url"),
    bootstrapSecret: randomBytes(32).toString("base64url"),
  };
}

export function renderEnvFile(secrets, deploymentId) {
  return [
    "APP_ENV=development",
    `APPS_SCRIPT_URL=https://script.google.com/macros/s/${deploymentId}/exec`,
    `APPS_SCRIPT_HMAC_SECRET=${secrets.hmacSecret}`,
    `CREDENTIAL_ENCRYPTION_KEY=${secrets.encryptionKey}`,
    `BOOTSTRAP_SECRET=${secrets.bootstrapSecret}`,
    "SESSION_COOKIE_NAME=kominfo_session",
    "",
  ].join("\n");
}

async function main() {
  const secrets = generateSecrets();
  if (process.argv[2] === "--write-env") {
    const deploymentId = process.argv[3];
    if (!deploymentId) throw new Error("Usage: node scripts/generate-secrets.mjs --write-env <deployment-id>");
    await writeFile(new URL("../.env.local", import.meta.url), renderEnvFile(secrets, deploymentId), { encoding: "utf8", flag: "wx", mode: 0o600 });
    console.log("Created .env.local with server-only Google backend configuration.");
    return;
  }
  console.log(`APPS_SCRIPT_HMAC_SECRET=${secrets.hmacSecret}`);
  console.log(`CREDENTIAL_ENCRYPTION_KEY=${secrets.encryptionKey}`);
  console.log(`BOOTSTRAP_SECRET=${secrets.bootstrapSecret}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();

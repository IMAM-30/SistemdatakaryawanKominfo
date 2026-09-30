import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function updateAppsScriptUrl(envText, deploymentId) {
  if (!DEPLOYMENT_ID_PATTERN.test(deploymentId)) {
    throw new Error("Invalid Apps Script deployment ID");
  }

  const nextUrl = `https://script.google.com/macros/s/${deploymentId}/exec`;
  const linePattern = /^APPS_SCRIPT_URL=.*$/m;
  if (!linePattern.test(envText)) {
    throw new Error("APPS_SCRIPT_URL is missing from .env.local");
  }
  return envText.replace(linePattern, `APPS_SCRIPT_URL=${nextUrl}`);
}

async function main() {
  const deploymentId = process.argv[2];
  if (!deploymentId) {
    throw new Error("Usage: node scripts/update-apps-script-url.mjs <deployment-id>");
  }

  const envUrl = new URL("../.env.local", import.meta.url);
  const temporaryUrl = new URL("../.env.local.tmp", import.meta.url);
  const current = await readFile(envUrl, "utf8");
  await writeFile(temporaryUrl, updateAppsScriptUrl(current, deploymentId), { encoding: "utf8", mode: 0o600 });
  await rename(temporaryUrl, envUrl);
  await chmod(envUrl, 0o600);
  console.log("Updated APPS_SCRIPT_URL; existing secrets were preserved.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();

import { readFile, readdir } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../apps-script/", import.meta.url);
const files = (await readdir(root)).filter((name) => name.endsWith(".gs")).sort();
const combined = (await Promise.all(files.map((name) => readFile(new URL(name, root), "utf8")))).join("\n");

for (const required of ["doGet", "doPost", "setupProject", "configureProject", "verifySignedEnvelope_", "withLock_", "uploadPhoto_"]) {
  if (!new RegExp(`function\\s+${required}\\s*\\(`).test(combined)) throw new Error(`Apps Script function missing: ${required}`);
}
for (const forbidden of [/password\s*:\s*['\"][^'\"]+['\"]/i, /SPREADSHEET_ID\s*:\s*['\"]1[A-Za-z0-9_-]+/]) {
  if (forbidden.test(combined)) throw new Error(`Possible hard-coded secret or resource ID: ${forbidden}`);
}

new vm.Script(combined, { filename: "apps-script-bundle.gs" });
const manifest = JSON.parse(await readFile(new URL("appsscript.json", root), "utf8"));
if (manifest.timeZone !== "Asia/Makassar" || manifest.runtimeVersion !== "V8") throw new Error("Apps Script manifest is not production-ready");
if (manifest.webapp?.access !== "ANYONE_ANONYMOUS" || manifest.webapp?.executeAs !== "USER_DEPLOYING") {
  throw new Error("Apps Script Web App must run as its deployer and allow HMAC-authenticated server calls");
}
console.log(`Apps Script verified: ${files.length} source files, syntax valid, required functions present.`);

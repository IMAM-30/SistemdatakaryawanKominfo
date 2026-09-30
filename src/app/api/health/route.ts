import { callAppsScript } from "@/lib/server/apps-script-client";
import { apiError, ok } from "@/lib/server/http";
export async function GET() { try { return ok(await callAppsScript("health", {})); } catch (error) { return apiError(error); } }

import { z } from "zod";
import { callAppsScript, BackendError } from "@/lib/server/apps-script-client";
import { protectPassword } from "@/lib/server/credentials";
import { getServerEnv } from "@/lib/server/env";
import { apiError, ok, readJson, safeEqual } from "@/lib/server/http";

const schema = z.object({ username: z.string().trim().min(3).max(64), displayName: z.string().trim().min(2).max(100), password: z.string().min(10).max(128) });
export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    const supplied = request.headers.get("x-bootstrap-secret") ?? "";
    if (!safeEqual(supplied, env.BOOTSTRAP_SECRET)) throw new BackendError("FORBIDDEN", "Bootstrap tidak diizinkan.", 403);
    const input = schema.parse(await readJson(request));
    const protectedPassword = await protectPassword(input.password, env.CREDENTIAL_ENCRYPTION_KEY);
    const result = await callAppsScript("auth.bootstrapMaster", { ...input, ...protectedPassword, bootstrapSecret: supplied });
    return ok(result, 201);
  } catch (error) { return apiError(error); }
}

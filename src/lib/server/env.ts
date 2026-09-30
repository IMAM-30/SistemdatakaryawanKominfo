import { z } from "zod";

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  APPS_SCRIPT_URL: z.string().url().refine((url) => url.endsWith("/exec"), "APPS_SCRIPT_URL must be a deployed /exec URL"),
  APPS_SCRIPT_HMAC_SECRET: z.string().min(32),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(43),
  BOOTSTRAP_SECRET: z.string().min(24),
  SESSION_COOKIE_NAME: z.string().default("kominfo_session"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  cached = serverEnvSchema.parse(process.env);
  return cached;
}

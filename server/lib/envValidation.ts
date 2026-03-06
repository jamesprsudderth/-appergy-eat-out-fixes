import { z } from "zod";
import { logWarn, logError } from "./logger";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  /** Server port (Railway sets this automatically) */
  PORT: z.coerce.number().int().positive().default(5000),

  /** OpenAI secret key — required in production */
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),

  /**
   * Firebase Admin service account JSON string (optional).
   * When absent the SDK falls back to Application Default Credentials,
   * which works automatically on Cloud Run.
   * For local dev: set this or run `gcloud auth application-default login`.
   */
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),

  /**
   * RevenueCat secret (server-side) key.
   * Required to verify entitlements server-side.
   * Find it in RevenueCat dashboard → Project → API Keys → Secret keys.
   */
  REVENUECAT_SECRET_KEY: z.string().optional(),

  /** Replit-specific (optional) */
  REPLIT_DEV_DOMAIN: z.string().optional(),
  REPLIT_DOMAINS: z.string().optional(),
  EXPO_DEV_PORT: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (result.success) return result.data;

  const isProd = process.env.NODE_ENV === "production";
  const formatted = result.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");

  if (isProd) {
    logError("Invalid environment variables — aborting", { issues: formatted });
    process.exit(1);
  }

  logWarn("Invalid environment variables (non-fatal in dev)", {
    issues: formatted,
  });

  // Return partial parse with defaults so dev server can still boot
  return envSchema
    .partial({ OPENAI_API_KEY: true })
    .parse(process.env) as Env;
}

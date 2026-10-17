import { z } from "zod";

export const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z
    .string()
    .min(1, "TELEGRAM_BOT_TOKEN is required")
    .regex(/^\d{8,11}:[A-Za-z0-9_-]{35,}$/, "Invalid Telegram Bot Token format"),
  UMAMI_BASE_URL: z
    .string()
    .url("UMAMI_BASE_URL must be a valid URL")
    .transform((url) => url.replace(/\/+$/, "")),
  UMAMI_API_KEY: z.string().min(1, "UMAMI_API_KEY is required"),
  PROJECTS_CONFIG_PATH: z.string().default("./projects.json"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
});

export type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const raw = {
    TELEGRAM_BOT_TOKEN: process.env["TELEGRAM_BOT_TOKEN"],
    UMAMI_BASE_URL: process.env["UMAMI_BASE_URL"],
    UMAMI_API_KEY: process.env["UMAMI_API_KEY"],
    PROJECTS_CONFIG_PATH: process.env["PROJECTS_CONFIG_PATH"] ?? "./projects.json",
    LOG_LEVEL: process.env["LOG_LEVEL"] ?? "info",
    NODE_ENV: process.env["NODE_ENV"] ?? "production",
  };

  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map((issue) => ` - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment configuration validation failed:\n${errorMessages}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}

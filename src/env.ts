/**
 * Centralized environment loader + validation using zod.
 *
 * - Loads `.env` in non-production environments (via dotenv).
 * - Validates & parses environment variables with zod.
 * - Exposes a typed `env` object for the rest of the application.
 *
 * Usage:
 *   import { env } from '~/env';
 *
 * Notes:
 * - Keep this file small and only put environment-related logic here.
 * - Add new variables to the schema below and use them via `env.<NAME>`.
 */

import { z } from "zod";
import dotenv from "dotenv";

// Only load .env files outside production so host-provided envvars (e.g. in production) are not overwritten.
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

/**
 * Schema for environment variables we care about.
 * Use `preprocess` for conversions (e.g. ports).
 */
const envSchema = z.object({
  // general
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // deployment / app urls
  APP_URL: z.string().url().default("http://localhost:5173"),
  APP_NAME: z.string().default("Digitalumni"),

  // security
  MAGIC_LINK_SECRET: z.string(),

  // email (SMTP)
  SMTP_HOST: z.string(),
  SMTP_PORT: z.preprocess((val) => {
    // Allow strings to be parsed to numbers (common when coming from process.env)
    if (typeof val === "string" && val.trim().length > 0) {
      const n = Number(val);
      return Number.isNaN(n) ? undefined : n;
    }
    if (typeof val === "number") {
      return val;
    }
    return undefined;
  }, z.number().int().positive().default(587)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email(),

  // S3 / Storage
  AWS_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  S3_BUCKET: z.string(),
  S3_UPLOAD_PATH: z.string().default("uploads"),
});

/**
 * Parse & validate. Throw early with helpful diagnostics if validation fails.
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print a readable error and stop startup so misconfiguration is visible immediately.
  // The formatted error is often nested; showing it via JSON is usually readable in logs.
  // Keep the message concise for end-users and print details to stderr.
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:");
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  throw new Error("Invalid environment variables. See stderr for details.");
}

const _env = parsed.data;

/**
 * Compute derived values and sensible defaults that depend on multiple env vars.
 */
export const env = {
  // from schema
  NODE_ENV: _env.NODE_ENV,
  APP_NAME: _env.APP_NAME,
  APP_URL: _env.APP_URL,
  MAGIC_LINK_SECRET: _env.MAGIC_LINK_SECRET,
  SMTP_HOST: _env.SMTP_HOST,
  SMTP_PORT: _env.SMTP_PORT,
  SMTP_USER: _env.SMTP_USER,
  SMTP_PASS: _env.SMTP_PASS,
  SMTP_FROM: _env.SMTP_FROM,
  AWS_REGION: _env.AWS_REGION,
  AWS_ACCESS_KEY_ID: _env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: _env.AWS_SECRET_ACCESS_KEY,
  S3_BUCKET: _env.S3_BUCKET,
  S3_UPLOAD_PATH: _env.S3_UPLOAD_PATH,

  // helpful booleans
  isProduction: _env.NODE_ENV === "production",
  isDevelopment: _env.NODE_ENV === "development",
} as const;

export type Env = typeof env;

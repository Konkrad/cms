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

import dotenv from "dotenv";
import { z } from "zod";
import { siteLocaleSchema } from "./core/i18n/locales";

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
	PORT: z.coerce.number().int().positive().default(3000),
	APP_URL: z.string().url().default("http://localhost:5173"),
	APP_NAME: z.string().default("Community Management System"),
	// UI language of the whole site (spec 4.8): "en" or "de". Applied at build time (the
	// catalog is merged into the bundle by the cms:i18n Vite plugin); missing keys fall back
	// to English. The production server refuses to start with another value than its build's.
	SITE_LOCALE: siteLocaleSchema,

	// database
	DB_PATH: z.string().default("my-database.db"),

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
	// Accepts either a bare address or the RFC 5322 "Display Name <address>"
	// form nodemailer/SMTP expect, so a sender name can be configured directly
	// (e.g. `28DIGITAL Alumni <no-reply@tx.konrad.online>`).
	SMTP_FROM: z.string().min(1),

	// S3 / Storage
	AWS_REGION: z.string().default("us-east-1"),
	AWS_ENDPOINT: z.string().optional(),
	AWS_ACCESS_KEY_ID: z.string(),
	AWS_SECRET_ACCESS_KEY: z.string(),
	S3_BUCKET: z.string(),
	S3_UPLOAD_PATH: z.string().default("uploads"),

	// Payments (spec 4.7). Stripe is the only provider: it is configured when both the secret
	// key and the webhook signing secret are set; without them payments are disabled
	// (`payments.enabled()` is false) and modules offer free flows only.
	STRIPE_SECRET_KEY: z.string().min(1).optional(),
	STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
	// Optional: point to a local stripe-mock or other custom Stripe API host
	STRIPE_API_BASE_URL: z.url().optional(),
	// Optional: SOCKS5 proxy for reaching Stripe from IPv4-less hosts (e.g. socks5h://172.19.0.1:40000)
	STRIPE_PROXY_URL: z.url().optional(),
	// Currency of every payment (ISO 4217, lower case)
	PAYMENTS_CURRENCY: z
		.string()
		.regex(/^[a-z]{3}$/)
		.default("eur"),
	// An unfinished checkout expires after this many minutes (Stripe allows 30 to 1440); the
	// hourly core schedule then marks it expired and calls the module's `onExpired`.
	PAYMENTS_CHECKOUT_EXPIRY_MINUTES: z.coerce
		.number()
		.int()
		.min(30)
		.max(1440)
		.default(60),

	// Telegram (optional: without them the telegram notification channel is unconfigured and
	// its outbox rows are marked failed with a clear error, see src/core/notifications)
	TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
	TELEGRAM_CHANNEL_ID: z.string().min(1).optional(),
	// Optional: point to a local mock server (e.g. http://localhost:8099) in tests
	TELEGRAM_API_URL: z.url().optional(),

	// ALTCHA
	ALTCHA_HMAC_KEY: z.string().default("change-this-altcha-key"),

	// Notification outbox worker
	NOTIFICATIONS_POLL_INTERVAL_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(5000),
	NOTIFICATIONS_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

	// Scheduler (manifest `schedules`) and retried handler calls (review decisions)
	SCHEDULER_POLL_INTERVAL_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(30_000),

	// Login throttling (sending magic-link / OTP emails)
	LOGIN_EMAIL_MAX_PER_WINDOW: z.coerce.number().int().positive().default(3),
	LOGIN_EMAIL_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
	LOGIN_IP_MAX_PER_WINDOW: z.coerce.number().int().positive().default(10),
	LOGIN_IP_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),

	// Social web module (spec 5.3): one site-wide, pull-only account `<account>@<APP_URL host>`
	// (WebFinger, ActivityPoll actor) and the RSS feed. Summary: actor summary and RSS channel
	// description (empty = the site name). Update interval: typical time between new posts, an
	// xsd:duration for the actor's `updateInterval` (FEP-b06c). Icon: path or URL of the image.
	SOCIAL_WEB_ACCOUNT: z
		.string()
		.regex(/^[a-z0-9][a-z0-9._-]*$/i)
		.default("news"),
	SOCIAL_WEB_SUMMARY: z.string().default(""),
	SOCIAL_WEB_UPDATE_INTERVAL: z
		.string()
		.regex(
			/^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/,
		)
		.default("P1D"),
	SOCIAL_WEB_ICON: z.string().default("/favicon.svg"),

	// Scope tree: the kinds a group below the root can have (deployment configuration, spec
	// 4.2), comma-separated, in the order the admin offers them. The root's kind is "root".
	// Module admin sections may be limited to some of these kinds (`scopes` in the manifest).
	SCOPE_KINDS: z
		.string()
		.default("region,chapter")
		.transform((value) =>
			value
				.split(",")
				.map((kind) => kind.trim())
				.filter(Boolean),
		)
		.pipe(
			z
				.array(z.string().regex(/^[a-z][a-z0-9-]*$/))
				.min(1)
				.refine((kinds) => !kinds.includes("root"), {
					message: '"root" is the root\'s kind, not a configurable one',
				})
				.refine((kinds) => new Set(kinds).size === kinds.length, {
					message: "Duplicate scope kind",
				}),
		),
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
	PORT: _env.PORT,
	APP_NAME: _env.APP_NAME,
	APP_URL: _env.APP_URL,
	SITE_LOCALE: _env.SITE_LOCALE,
	DB_PATH: _env.DB_PATH,
	MAGIC_LINK_SECRET: _env.MAGIC_LINK_SECRET,
	SMTP_HOST: _env.SMTP_HOST,
	SMTP_PORT: _env.SMTP_PORT,
	SMTP_USER: _env.SMTP_USER,
	SMTP_PASS: _env.SMTP_PASS,
	SMTP_FROM: _env.SMTP_FROM,
	AWS_REGION: _env.AWS_REGION,
	AWS_ENDPOINT: _env.AWS_ENDPOINT,
	AWS_ACCESS_KEY_ID: _env.AWS_ACCESS_KEY_ID,
	AWS_SECRET_ACCESS_KEY: _env.AWS_SECRET_ACCESS_KEY,
	S3_BUCKET: _env.S3_BUCKET,
	S3_UPLOAD_PATH: _env.S3_UPLOAD_PATH,
	STRIPE_SECRET_KEY: _env.STRIPE_SECRET_KEY,
	STRIPE_WEBHOOK_SECRET: _env.STRIPE_WEBHOOK_SECRET,
	STRIPE_API_BASE_URL: _env.STRIPE_API_BASE_URL,
	STRIPE_PROXY_URL: _env.STRIPE_PROXY_URL,
	PAYMENTS_CURRENCY: _env.PAYMENTS_CURRENCY,
	PAYMENTS_CHECKOUT_EXPIRY_MINUTES: _env.PAYMENTS_CHECKOUT_EXPIRY_MINUTES,
	TELEGRAM_BOT_TOKEN: _env.TELEGRAM_BOT_TOKEN,
	TELEGRAM_CHANNEL_ID: _env.TELEGRAM_CHANNEL_ID,
	TELEGRAM_API_URL: _env.TELEGRAM_API_URL,
	ALTCHA_HMAC_KEY: _env.ALTCHA_HMAC_KEY,
	NOTIFICATIONS_POLL_INTERVAL_MS: _env.NOTIFICATIONS_POLL_INTERVAL_MS,
	NOTIFICATIONS_MAX_ATTEMPTS: _env.NOTIFICATIONS_MAX_ATTEMPTS,
	SCHEDULER_POLL_INTERVAL_MS: _env.SCHEDULER_POLL_INTERVAL_MS,
	LOGIN_EMAIL_MAX_PER_WINDOW: _env.LOGIN_EMAIL_MAX_PER_WINDOW,
	LOGIN_EMAIL_WINDOW_MINUTES: _env.LOGIN_EMAIL_WINDOW_MINUTES,
	LOGIN_IP_MAX_PER_WINDOW: _env.LOGIN_IP_MAX_PER_WINDOW,
	LOGIN_IP_WINDOW_MINUTES: _env.LOGIN_IP_WINDOW_MINUTES,
	SCOPE_KINDS: _env.SCOPE_KINDS as readonly string[],
	SOCIAL_WEB_ACCOUNT: _env.SOCIAL_WEB_ACCOUNT,
	SOCIAL_WEB_SUMMARY: _env.SOCIAL_WEB_SUMMARY,
	SOCIAL_WEB_UPDATE_INTERVAL: _env.SOCIAL_WEB_UPDATE_INTERVAL,
	SOCIAL_WEB_ICON: _env.SOCIAL_WEB_ICON,

	// helpful booleans
	isProduction: _env.NODE_ENV === "production",
} as const;

export type Env = typeof env;

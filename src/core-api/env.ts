/** Env-derived values for modules. Modules must not import `~/env`; add a getter here instead. Server-only. */
import { env } from "~/env";

/** Public base URL of this site (no trailing-slash guarantee). */
export const getAppUrl = (): string => env.APP_URL;

/** Stripe client settings (secret key plus optional dev/proxy overrides). */
export const getStripeEnv = () => ({
	secretKey: env.STRIPE_SECRET_KEY,
	apiBaseUrl: env.STRIPE_API_BASE_URL,
	proxyUrl: env.STRIPE_PROXY_URL,
});

/** Stripe publishable key handed to the browser for Stripe.js. */
export const getStripePublishableKey = (): string => env.STRIPE_PUBLISHABLE_KEY;

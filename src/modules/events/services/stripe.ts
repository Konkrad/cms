import { SocksProxyAgent } from "socks-proxy-agent";
import Stripe from "stripe";
import { getStripeEnv } from "~/core";

const env = getStripeEnv();

const stripeConfig: ConstructorParameters<typeof Stripe>[1] = {
	apiVersion: "2026-06-24.dahlia",
};

if (env.apiBaseUrl) {
	const url = new URL(env.apiBaseUrl);
	stripeConfig.host = url.hostname;

	const protocol = url.protocol.replace(/:$/, "") as "http" | "https";
	if (protocol === "http" || protocol === "https") {
		stripeConfig.protocol = protocol;
	}

	if (url.port) {
		stripeConfig.port = Number(url.port);
	}
}

// Some hosts (e.g. IPv6-only servers) have no outbound path to Stripe's
// IPv4-only API. STRIPE_PROXY_URL routes those requests through a local
// SOCKS5 proxy (e.g. a Cloudflare WARP sidecar) instead.
if (env.proxyUrl) {
	stripeConfig.httpAgent = new SocksProxyAgent(env.proxyUrl);
}

const stripe = new Stripe(env.secretKey, stripeConfig);

export const stripeService = {
	stripe,

	async createProduct(name: string, description: string) {
		return stripe.products.create({
			name,
			description,
		});
	},

	async getPaymentIntent(paymentIntentId: string) {
		return stripe.paymentIntents.retrieve(paymentIntentId);
	},

	async createCheckoutSession(params: {
		lineItems: NonNullable<Stripe.Checkout.SessionCreateParams["line_items"]>;
		successUrl: string;
		cancelUrl: string;
		metadata: Record<string, string>;
	}) {
		return stripe.checkout.sessions.create({
			mode: "payment",
			line_items: params.lineItems,
			success_url: params.successUrl,
			cancel_url: params.cancelUrl,
			metadata: params.metadata,
		});
	},
};

import Stripe from "stripe";
import { env } from "~/env";

const stripeConfig: Stripe.StripeConfig = {
  apiVersion: "2025-12-15.clover",
};

if (env.STRIPE_API_BASE_URL) {
  const url = new URL(env.STRIPE_API_BASE_URL);
  stripeConfig.host = url.hostname;

  // `StripeConfig.protocol` is strictly typed as 'http' | 'https'.
  const protocol = url.protocol.replace(/:$/, "") as Stripe.HttpProtocol;
  if (protocol === "http" || protocol === "https") {
    stripeConfig.protocol = protocol;
  }

  if (url.port) {
    stripeConfig.port = Number(url.port);
  }
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY, stripeConfig);

export const stripeService = {
  stripe,

  async createProduct(name: string, description: string) {
    return stripe.products.create({
      name,
      description,
    });
  },

  async createCheckoutSession(params: {
    lineItems: Array<{
      price_data: {
        currency: string;
        product_data: { name: string };
        unit_amount: number;
      };
      quantity: number;
    }>;
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

  async getSession(sessionId: string) {
    return stripe.checkout.sessions.retrieve(sessionId);
  },
};

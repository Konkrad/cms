import Stripe from "stripe";
import { env } from "~/env";

const stripeConfig: ConstructorParameters<typeof Stripe>[1] = {
  apiVersion: "2026-04-22.dahlia",
};

if (env.STRIPE_API_BASE_URL) {
  const url = new URL(env.STRIPE_API_BASE_URL);
  stripeConfig.host = url.hostname;

  const protocol = url.protocol.replace(/:$/, "") as "http" | "https";
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

  async getPaymentIntent(paymentIntentId: string) {
    return stripe.paymentIntents.retrieve(paymentIntentId);
  },
};

import Stripe from "stripe";
import { env } from "~/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
});

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

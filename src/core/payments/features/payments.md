---
status: shipped
code:
  - src/core/payments/payments.ts
  - src/core/payments/stripe-provider.ts
  - src/core/payments/handlers.ts
tags: [core, payments]
---
# Payments

Generic payments for all modules, with Stripe Checkout as the one provider. Used by [[ticket-checkout]].

## Rules
- A module computes the lines from its DB prices and calls `payments.create`; the buyer is redirected to the provider.
- **Only the verified webhook proves a payment.** Returning to the success page proves nothing (`payments.statusForOwner`).
- Each status change (paid, failed, expired, refunded, …) runs the module's handler once, retried until it succeeds, even when the module is inactive. Core also sends a receipt email.
- A checkout is open for `PAYMENTS_CHECKOUT_EXPIRY_MINUTES` (default 60); Stripe gets the same expiry time. An hourly job expires abandoned checkouts: it first closes the session at Stripe, so the buyer can no longer pay. A session the buyer already completed is left alone, including delayed methods (e.g. SEPA) whose money arrives days later; their paid or failed event follows.
- Without a provider configured, payments are disabled and modules offer free flows.
- Root admins list and refund payments at `/admin/root/payments`.

## Data
- `payments(moduleId, kind, refId, userId, status, provider, amount in cents, currency, lines, expiresAt, paidAt, …)`: `moduleId` + `kind` + `refId` point to the module's own record (for tickets: the order).
- `payment_events(paymentId, change, providerEventId)`: one row per status change, so each change is handled once.

## Decisions
- One generic payments table plus per-module hooks, instead of payment code in every module.
- Open: partial refunds (#124), subscriptions (#125).

import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { users } from "../users/schema";

/**
 * Payment statuses (spec 4.7). One-off payments: `pending` → `paid` | `failed` | `expired`,
 * `paid` → `refunded`. Subscriptions: `pending` → `active` (first payment) → `past_due` (a
 * renewal failed) → `active` again, or `canceled`.
 */
export const PAYMENT_STATUSES = [
	"pending",
	"paid",
	"failed",
	"expired",
	"refunded",
	"active",
	"past_due",
	"canceled",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_MODES = ["payment", "subscription"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

/** What a payment is for, as the module computed it on the server (amounts in minor units). */
export interface PaymentLine {
	label: string;
	/** Unit amount in minor units (cents), computed by the module from its own records. */
	amount: number;
	quantity: number;
	description?: string;
	/** Absolute URL of a public image shown on the provider's checkout page. */
	imageUrl?: string;
	/** Subscriptions only: the billing interval. */
	interval?: "month" | "year";
}

/**
 * A payment a module created (spec 4.7). Core stores it with the owning module, the module's
 * handler `kind` and its own record (`refId`), and calls that module back by name when the
 * status changes. `providerRef` is the provider's checkout (Stripe Checkout Session id),
 * `providerPaymentRef` the payment or subscription behind it once known (PaymentIntent or
 * Subscription id), used for refunds and later events.
 */
export const payments = sqliteTable(
	"payments",
	{
		id: text("id").primaryKey(),
		moduleId: text("module_id").notNull(),
		kind: text("kind").notNull(),
		refId: text("ref_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		status: text("status", { enum: PAYMENT_STATUSES })
			.notNull()
			.default("pending"),
		mode: text("mode", { enum: PAYMENT_MODES }).notNull().default("payment"),
		provider: text("provider").notNull(),
		providerRef: text("provider_ref"),
		providerPaymentRef: text("provider_payment_ref"),
		/** Total in minor units (cents): the sum of `lines`. */
		amount: integer("amount").notNull(),
		currency: text("currency").notNull(),
		lines: text("lines", { mode: "json" }).$type<PaymentLine[]>().notNull(),
		/** The item the payment is for (a reference, `events:event:<id>`), for admin links. */
		subjectRef: text("subject_ref"),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
		/** An unfinished checkout is marked expired after this (the core expiry schedule). */
		expiresAt: text("expires_at"),
		paidAt: text("paid_at"),
	},
	(t) => [
		index("payments_status_expires_idx").on(t.status, t.expiresAt),
		index("payments_module_idx").on(t.moduleId, t.kind, t.refId),
		index("payments_provider_ref_idx").on(t.providerRef),
		index("payments_provider_payment_ref_idx").on(t.providerPaymentRef),
	],
);

export type Payment = typeof payments.$inferSelect;

/**
 * One row per status change a payment went through (`change` = the new status, or
 * `renewed:<invoice>` / `payment_failed:<invoice>` for subscription cycles) with the provider
 * event that caused it. The unique (paymentId, change) makes a resent provider event a no-op,
 * so the module's handler is called once per change.
 */
export const paymentEvents = sqliteTable(
	"payment_events",
	{
		id: text("id").primaryKey(),
		paymentId: text("payment_id")
			.notNull()
			.references(() => payments.id, { onDelete: "cascade" }),
		change: text("change").notNull(),
		/** The provider's event id (`evt_…`), or null for core's own changes (expiry). */
		providerEventId: text("provider_event_id"),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(t) => [
		uniqueIndex("payment_events_change_unique").on(t.paymentId, t.change),
	],
);

export type PaymentEvent = typeof paymentEvents.$inferSelect;

import { and, desc, eq, inArray, lte, or, type SQL } from "drizzle-orm";
import { db } from "~/core/db/connection";
import {
	type Payment,
	type PaymentStatus,
	paymentEvents,
	payments,
} from "~/core/payments/schema";
import { publicUserSelect } from "~/core/users/public-user";
import { users } from "~/core/users/schema";

export type NewPayment = Omit<
	typeof payments.$inferInsert,
	"id" | "status" | "createdAt" | "updatedAt" | "paidAt"
>;

export interface PaymentFilter {
	moduleId?: string;
	status?: PaymentStatus;
}

/** The `payments` and `payment_events` tables (spec 4.7). Server-only. */
export const paymentsService = {
	async insert(data: NewPayment, now: Date = new Date()): Promise<Payment> {
		const iso = now.toISOString();
		const [row] = await db
			.insert(payments)
			.values({
				...data,
				id: crypto.randomUUID(),
				status: "pending",
				createdAt: iso,
				updatedAt: iso,
			})
			.returning();
		return row;
	},

	async delete(id: string): Promise<void> {
		await db.delete(payments).where(eq(payments.id, id));
	},

	async getById(id: string): Promise<Payment | undefined> {
		const [row] = await db.select().from(payments).where(eq(payments.id, id));
		return row;
	},

	async setProviderRef(id: string, providerRef: string): Promise<void> {
		await db.update(payments).set({ providerRef }).where(eq(payments.id, id));
	},

	/**
	 * The payment a provider event is about: by core's id when the provider carried it back,
	 * else by the provider's references. Only payments of that provider.
	 */
	async findForProviderEvent(
		provider: string,
		refs: {
			paymentId?: string | null;
			providerRef?: string | null;
			providerPaymentRef?: string | null;
		},
	): Promise<Payment | undefined> {
		const conditions: SQL[] = [];
		if (refs.paymentId) conditions.push(eq(payments.id, refs.paymentId));
		if (refs.providerRef)
			conditions.push(eq(payments.providerRef, refs.providerRef));
		if (refs.providerPaymentRef)
			conditions.push(eq(payments.providerPaymentRef, refs.providerPaymentRef));
		if (conditions.length === 0) return undefined;
		const [row] = await db
			.select()
			.from(payments)
			.where(and(eq(payments.provider, provider), or(...conditions)))
			.limit(1);
		return row;
	},

	/**
	 * Sets the new status if the row is still in `from` (another process may have moved it
	 * meanwhile); returns the updated row or undefined.
	 */
	async transition(
		id: string,
		from: PaymentStatus,
		set: {
			status: PaymentStatus;
			providerPaymentRef?: string | null;
			paidAt?: string;
		},
		now: Date,
	): Promise<Payment | undefined> {
		const [row] = await db
			.update(payments)
			.set({
				status: set.status,
				updatedAt: now.toISOString(),
				...(set.providerPaymentRef
					? { providerPaymentRef: set.providerPaymentRef }
					: {}),
				...(set.paidAt ? { paidAt: set.paidAt } : {}),
			})
			.where(and(eq(payments.id, id), eq(payments.status, from)))
			.returning();
		return row;
	},

	async hasEvent(paymentId: string, change: string): Promise<boolean> {
		const [row] = await db
			.select({ id: paymentEvents.id })
			.from(paymentEvents)
			.where(
				and(
					eq(paymentEvents.paymentId, paymentId),
					eq(paymentEvents.change, change),
				),
			);
		return row !== undefined;
	},

	/** Records a change once; a second record of the same (payment, change) is ignored. */
	async recordEvent(
		paymentId: string,
		change: string,
		providerEventId: string | null,
		now: Date,
	): Promise<void> {
		await db
			.insert(paymentEvents)
			.values({
				id: crypto.randomUUID(),
				paymentId,
				change,
				providerEventId,
				createdAt: now.toISOString(),
			})
			.onConflictDoNothing();
	},

	async eventsOf(paymentId: string) {
		return db
			.select()
			.from(paymentEvents)
			.where(eq(paymentEvents.paymentId, paymentId))
			.orderBy(paymentEvents.createdAt);
	},

	/** Unfinished checkouts past their expiry, oldest first. */
	async listStalePending(now: Date, limit = 100): Promise<Payment[]> {
		return db
			.select()
			.from(payments)
			.where(
				and(
					eq(payments.status, "pending"),
					lte(payments.expiresAt, now.toISOString()),
				),
			)
			.orderBy(payments.expiresAt)
			.limit(limit);
	},

	/** Payments for the root admin list, newest first, with the payer's public name. */
	async listForAdmin(filter: PaymentFilter, limit = 200) {
		const conditions: SQL[] = [];
		if (filter.moduleId)
			conditions.push(eq(payments.moduleId, filter.moduleId));
		if (filter.status) conditions.push(eq(payments.status, filter.status));
		return db
			.select({
				id: payments.id,
				moduleId: payments.moduleId,
				kind: payments.kind,
				refId: payments.refId,
				status: payments.status,
				mode: payments.mode,
				provider: payments.provider,
				providerRef: payments.providerRef,
				amount: payments.amount,
				currency: payments.currency,
				subjectRef: payments.subjectRef,
				createdAt: payments.createdAt,
				paidAt: payments.paidAt,
				user: publicUserSelect,
			})
			.from(payments)
			.innerJoin(users, eq(users.id, payments.userId))
			.where(conditions.length ? and(...conditions) : undefined)
			.orderBy(desc(payments.createdAt))
			.limit(limit);
	},

	/** Module ids that have payments (the admin filter). */
	async moduleIds(): Promise<string[]> {
		const rows = await db
			.selectDistinct({ moduleId: payments.moduleId })
			.from(payments)
			.orderBy(payments.moduleId);
		return rows.map((r) => r.moduleId);
	},

	async getByIds(ids: string[]): Promise<Payment[]> {
		if (ids.length === 0) return [];
		return db.select().from(payments).where(inArray(payments.id, ids));
	},
};

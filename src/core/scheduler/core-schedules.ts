import type { ScheduleDefinition } from "~/core/scheduler/define";

/** Recurring jobs of core itself (same shape as a manifest's `schedules`). */
export const coreSchedules: ScheduleDefinition[] = [
	// Spec 4.7: checkouts never completed are marked expired after
	// PAYMENTS_CHECKOUT_EXPIRY_MINUTES and the owning module's `onExpired` is called.
	{
		id: "payments-expiry",
		every: "1h",
		run: async ({ now }) => {
			// Lazy: the payments core loads the provider adapter.
			await (await import("~/core/payments/payments")).expireStalePayments(now);
		},
	},
];

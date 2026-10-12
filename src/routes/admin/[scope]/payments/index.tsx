import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { formatMoney } from "~/core/payments/money";
import {
	cancelSubscription,
	PaymentActionError,
	refundPayment,
} from "~/core/payments/payments";
import { paymentsService } from "~/core/payments/payments.service";
import { PAYMENT_STATUSES, type PaymentStatus } from "~/core/payments/schema";
import { resolveRefs } from "~/core/registry/refs";
import { requireSystemAdmin } from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

/** Every payment of every module (spec 4.7), newest first, filtered by module and status. */
export const usePayments = routeLoader$(async (event) => {
	await requireSystemAdmin(event);
	const moduleId = event.url.searchParams.get("module") || undefined;
	const statusParam = event.url.searchParams.get("status") ?? "";
	const status = (PAYMENT_STATUSES as readonly string[]).includes(statusParam)
		? (statusParam as PaymentStatus)
		: undefined;
	const rows = await paymentsService.listForAdmin({ moduleId, status });
	const urls = await resolveRefs(
		rows.flatMap((r) => (r.subjectRef ? [r.subjectRef] : [])),
	);
	return assertNoPrivateFields({
		filter: { moduleId: moduleId ?? "", status: status ?? "" },
		modules: await paymentsService.moduleIds(),
		statuses: [...PAYMENT_STATUSES],
		payments: rows.map((r) => ({
			id: r.id,
			moduleId: r.moduleId,
			kind: r.kind,
			refId: r.refId,
			status: r.status,
			mode: r.mode,
			provider: r.provider,
			providerRef: r.providerRef,
			amount: formatMoney(r.amount, r.currency),
			payer: [r.user.name, r.user.familyName].filter(Boolean).join(" "),
			subjectRef: r.subjectRef,
			subjectUrl: r.subjectRef ? (urls.get(r.subjectRef) ?? null) : null,
			createdAt: r.createdAt,
			paidAt: r.paidAt,
		})),
	});
});

/** Refunds a paid payment in full through the provider; the module's `onRefunded` follows. */
export const useRefundPayment = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);
		try {
			await refundPayment(data.id);
		} catch (error) {
			if (error instanceof PaymentActionError)
				return event.fail(400, { message: error.message });
			throw error;
		}
		return { success: true };
	},
	zod$({ id: z.string().uuid() }),
);

/** Cancels a running subscription through the provider; the module's `onCanceled` follows. */
export const useCancelSubscription = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);
		try {
			await cancelSubscription(data.id);
		} catch (error) {
			if (error instanceof PaymentActionError)
				return event.fail(400, { message: error.message });
			throw error;
		}
		return { success: true };
	},
	zod$({ id: z.string().uuid() }),
);

const formatDate = (iso: string | null) =>
	iso ? new Date(iso).toLocaleString("en-GB") : "—";

const STATUS_CLASS: Record<string, string> = {
	paid: "bg-green-100 text-green-800",
	active: "bg-green-100 text-green-800",
	pending: "bg-yellow-100 text-yellow-800",
	past_due: "bg-yellow-100 text-yellow-800",
};

export default component$(() => {
	const data = usePayments();
	const refund = useRefundPayment();
	const cancel = useCancelSubscription();
	const { filter, payments } = data.value;
	const error = refund.value?.message ?? cancel.value?.message;

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">Payments</h2>
			</div>
			<p class="text-sm text-gray-500 mb-6">
				Payments created by modules. Their status comes from the payment
				provider; the module is called back on every change.
			</p>

			<form method="get" class="flex flex-wrap gap-3 items-end mb-4">
				<label class="text-sm">
					<span class="block text-gray-600 mb-1">Module</span>
					<select name="module" class="border rounded px-2 py-1">
						<option value="">All</option>
						{data.value.modules.map((m) => (
							<option key={m} value={m} selected={m === filter.moduleId}>
								{m}
							</option>
						))}
					</select>
				</label>
				<label class="text-sm">
					<span class="block text-gray-600 mb-1">Status</span>
					<select name="status" class="border rounded px-2 py-1">
						<option value="">All</option>
						{data.value.statuses.map((s) => (
							<option key={s} value={s} selected={s === filter.status}>
								{s}
							</option>
						))}
					</select>
				</label>
				<button
					type="submit"
					class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
				>
					Filter
				</button>
			</form>

			{error && (
				<div class="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">
					{error}
				</div>
			)}

			<div
				class="bg-white rounded-lg shadow-sm overflow-x-auto"
				data-testid="payments-list"
			>
				{payments.length === 0 ? (
					<div class="px-5 py-8 text-center text-gray-400 text-sm">
						No payments.
					</div>
				) : (
					<table class="min-w-full divide-y divide-gray-200 text-sm">
						<thead class="bg-gray-50">
							<tr>
								{[
									"Status",
									"Module",
									"Item",
									"Payer",
									"Amount",
									"Created",
									"Paid",
									"Provider ref",
									"",
								].map((label) => (
									<th
										key={label}
										class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>
										{label}
									</th>
								))}
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{payments.map((p) => (
								<tr key={p.id} data-payment-id={p.id}>
									<td class="px-4 py-3">
										<span
											class={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
												STATUS_CLASS[p.status] ?? "bg-gray-100 text-gray-700"
											}`}
										>
											{p.status}
										</span>
									</td>
									<td class="px-4 py-3 font-mono text-xs">
										{p.moduleId}.{p.kind}
									</td>
									<td class="px-4 py-3">
										{p.subjectUrl ? (
											<a
												href={p.subjectUrl}
												class="text-blue-600 hover:text-blue-800"
											>
												{p.subjectRef}
											</a>
										) : (
											<span class="text-gray-500">{p.subjectRef ?? "—"}</span>
										)}
									</td>
									<td class="px-4 py-3">{p.payer}</td>
									<td class="px-4 py-3 whitespace-nowrap">{p.amount}</td>
									<td class="px-4 py-3 whitespace-nowrap">
										{formatDate(p.createdAt)}
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										{formatDate(p.paidAt)}
									</td>
									<td class="px-4 py-3 font-mono text-xs">
										{p.provider}: {p.providerRef ?? "—"}
									</td>
									<td class="px-4 py-3">
										{p.mode === "payment" && p.status === "paid" && (
											<Form action={refund}>
												<input type="hidden" name="id" value={p.id} />
												<button
													type="submit"
													class="text-red-600 hover:text-red-800 font-medium"
												>
													Refund
												</button>
											</Form>
										)}
										{p.mode === "subscription" &&
											(p.status === "active" || p.status === "past_due") && (
												<Form action={cancel}>
													<input type="hidden" name="id" value={p.id} />
													<button
														type="submit"
														class="text-red-600 hover:text-red-800 font-medium"
													>
														Cancel
													</button>
												</Form>
											)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
});

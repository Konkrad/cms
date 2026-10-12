import { createElement } from "react";
import { formatDate, formatMoney, t } from "~/core/i18n";
import { defineNotification } from "~/core/notifications/define";
import { notify } from "~/core/notifications/notify";
import type { PaymentInfo } from "~/core/payments/payments";
import { paymentsService } from "~/core/payments/payments.service";
import PaymentReceiptEmail from "~theme/emails/PaymentReceipt";

/**
 * The generic receipt core sends when a payment or a renewal is paid (spec 4.7). Modules send
 * their own domain mail (tickets with QR codes) besides it. Required: a receipt cannot be muted.
 */

export const paymentReceiptNotification = defineNotification<{
	paymentId: string;
	renewal: boolean;
}>({
	id: "payments.receipt",
	label: t("core.payments.receipt.label"),
	channels: ["email"],
	optional: false,
	render: {
		email: async (data, ctx) => {
			const payment = await paymentsService.getById(data.paymentId);
			if (!payment) throw new Error(`Payment ${data.paymentId} not found`);
			const total = formatMoney(payment.amount, payment.currency);
			return {
				subject: t("core.payments.receipt.subject", { total }),
				react: createElement(PaymentReceiptEmail, {
					baseUrl: ctx.appUrl,
					recipientName: ctx.recipient.name ?? "there",
					date: formatDate(payment.paidAt ?? payment.updatedAt),
					reference: payment.id,
					lines: payment.lines.map((line) => ({
						label: line.label,
						quantity: line.quantity,
						amount: formatMoney(line.amount * line.quantity, payment.currency),
					})),
					total,
					note: data.renewal ? t("core.payments.receipt.renewed") : null,
				}),
			};
		},
	},
});

/** Core's receipt handler (queued with the module's `onPaid` / `onRenewed`). */
export async function sendReceipt(payment: PaymentInfo): Promise<void> {
	await notify(paymentReceiptNotification.id, {
		to: payment.userId,
		data: { paymentId: payment.id, renewal: payment.change === "renewed" },
	});
}

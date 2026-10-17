/**
 * Root admin payments list (spec 4.7): every module's payments, filtered by module and
 * status, linked to the item, with a refund through the provider (stripe-mock).
 */
import {
	createPendingTicketPaymentInDb,
	createTestEventWithProduct,
	createUserSession,
	expect,
	getPaymentById,
	getTransactionStatus,
	test,
} from "../fixtures";
import { signedCheckoutEvent } from "../utils/stripe-webhook";

test.describe("Admin payments", () => {
	test("lists payments with filters and an item link, and refunds a paid one", async ({
		adminPage: page,
	}) => {
		const buyer = createUserSession("user", "pay-admin", {
			name: "Paula",
			familyName: "Payer",
		});
		const ev = createTestEventWithProduct({
			ownerId: buyer.userId,
			title: `Payments Admin Event ${Date.now()}`,
		});
		const pending = createPendingTicketPaymentInDb({
			buyerId: buyer.userId,
			eventId: ev.eventId,
			productId: ev.productId,
			unitPrice: 9,
		});
		const row = page.locator(`tr[data-payment-id="${pending.paymentId}"]`);
		try {
			await page.goto("/admin/root/payments");
			await expect(page.locator("h2", { hasText: "Payments" })).toBeVisible();
			await expect(row).toContainText("pending");
			await expect(row).toContainText("events.tickets");
			await expect(row).toContainText("Paula Payer");
			await expect(row).toContainText("€9.00");
			await expect(
				row.locator(`a[href$="/events/${ev.eventId}"]`),
			).toBeVisible();

			await page.goto("/admin/root/payments?module=events&status=paid");
			await expect(row).toHaveCount(0);
			await page.goto("/admin/root/payments?module=events&status=pending");
			await expect(row).toBeVisible();

			// Paid through the provider's signed webhook, then refunded from the list.
			const res = await page.request.post(
				"/api/payments/webhook/stripe",
				signedCheckoutEvent(pending.paymentId),
			);
			expect(res.status()).toBe(200);
			await expect
				.poll(() => getTransactionStatus(pending.paymentId), {
					timeout: 15_000,
				})
				.toBe("paid");
			await page.goto("/admin/root/payments?status=paid");
			await row.getByRole("button", { name: "Refund" }).click();
			await expect
				.poll(() => getPaymentById(pending.paymentId)?.status)
				.toBe("refunded");
			// The events module's onRefunded runs from the handler queue.
			await expect
				.poll(() => getTransactionStatus(pending.paymentId), {
					timeout: 15_000,
				})
				.toBe("refunded");
		} finally {
			pending.cleanup();
			ev.cleanup();
			buyer.cleanup();
		}
	});

	test("is not available to members", async ({ memberPage: page }) => {
		const res = await page.goto("/admin/root/payments");
		expect([403, 404]).toContain(res?.status());
	});
});

import type { PaymentInfo } from "~/core";
import { notify } from "~/core";
import {
	type SaleAlertData,
	saleAlertNotification,
	type TicketConfirmationData,
	ticketConfirmationNotification,
} from "./emails";
import { inventoryGroupsService } from "./services/inventory-groups";
import { participantsService } from "./services/participants";
import { productsService } from "./services/products";
import { ticketsService } from "./services/tickets";
import { transactionsService } from "./services/transactions";

/**
 * Payment handlers for ticket orders (manifest `payments.tickets`, spec 4.7). `payment.refId`
 * is the pending order (`transactions`) the checkout created; the order holds the line items
 * at DB prices and who the tickets are for. Core calls each handler once per status change
 * and retries it until it succeeds (also while the module is inactive), so every step here
 * is safe to repeat. Server-only.
 */

async function orderOf(payment: PaymentInfo) {
	const order = await transactionsService.getById(payment.refId);
	if (!order) throw new Error(`Order ${payment.refId} not found`);
	return order;
}

/** Paid: the order becomes paid, its tickets are issued and the buyer gets them by email. */
export async function onTicketsPaid(
	payment: PaymentInfo,
	{ now }: { now: Date },
): Promise<void> {
	const order = await orderOf(payment);
	const items = await transactionsService.itemsOf(order.id);
	const products = await Promise.all(
		items.map(async (item) => ({
			...item,
			product: await productsService.getById(item.productId),
		})),
	);

	// A late payment of an expired (canceled) order is honoured too: the money is taken.
	const becamePaid = await transactionsService.markPaid(order.id, now);
	if (becamePaid)
		for (const item of items)
			await productsService.incrementSold(item.productId, item.quantity);

	// Tickets once per order (a retry after a crash finds them).
	const existing = await ticketsService.getByTransactionId(order.id);
	const issued =
		existing.length === 0 ? await issueTickets(order, products) : [];
	// A ticket purchase turns a "maybe" into a "yes" (idempotent).
	if (issued.length + existing.length > 0) {
		const { participationService } = await import("./services/participation");
		await participationService.autoUpgradeToYes(order.userId, order.eventId);
	}
	if (!becamePaid && issued.length === 0) return;

	await notify(ticketConfirmationNotification.id, {
		to: order.userId,
		data: {
			eventId: order.eventId,
			transactionId: order.id,
			products: products.flatMap((p) =>
				p.product
					? [
							{
								name: p.product.name,
								quantity: p.quantity,
								amount: p.unitPrice,
							},
						]
					: [],
			),
			totalAmount: order.totalAmount,
			ticketIds: (issued.length > 0 ? issued : existing).map((t) => t.id),
		} satisfies TicketConfirmationData,
	});

	// "New sale" alert to the ops Telegram channel, one per product.
	for (const item of products) {
		if (!item.product) continue;
		await notify(saleAlertNotification.id, {
			to: { channel: "telegram", target: "ops" },
			data: {
				productName: item.product.name,
				quantity: item.quantity,
				amount: item.unitPrice * item.quantity,
				remaining: (
					await inventoryGroupsService.validatePurchase(
						item.product.inventoryGroupId,
						0,
					)
				).remainingCapacity,
			} satisfies SaleAlertData,
		});
	}
}

async function issueTickets(
	order: Awaited<ReturnType<typeof orderOf>>,
	products: Array<{
		productId: string;
		quantity: number;
		product: Awaited<ReturnType<typeof productsService.getById>>;
	}>,
) {
	const unitsByProduct = new Map(
		(order.participants ?? []).map((p) => [p.productId, p.participantUnits]),
	);
	const toCreate: Array<{
		productId: string;
		slots: Array<{
			name: string;
			email: string;
			existingUserId?: string | null;
		}>;
	}> = [];
	for (const item of products) {
		const group = await inventoryGroupsService.getById(
			item.product?.inventoryGroupId ?? "",
		);
		if (!group?.needsTicket) continue;
		const units = unitsByProduct.get(item.productId) ?? [];
		for (let i = 0; i < item.quantity; i++)
			toCreate.push({ productId: item.productId, slots: units[i] ?? [] });
	}
	if (toCreate.length === 0) return [];

	const created = await ticketsService.createBulk(
		toCreate.map((t) => ({
			transactionId: order.id,
			productId: t.productId,
			eventId: order.eventId,
			buyerId: order.userId,
		})),
	);
	for (let idx = 0; idx < created.length; idx++) {
		const slots = toCreate[idx]?.slots ?? [];
		if (slots.length === 0) continue;
		await participantsService.createBulk(
			slots.map((slot, slotIdx) => ({
				ticketId: created[idx].id,
				participantOrder: slotIdx + 1,
				name: slot.name,
				email: slot.email,
				userId: slot.existingUserId ?? null,
			})),
		);
	}
	return created;
}

/**
 * Failed or expired: the pending order is canceled. Checkouts hold no capacity (sold
 * quantities only count paid orders), so there is nothing else to release.
 */
export async function onTicketsCanceled(payment: PaymentInfo): Promise<void> {
	await transactionsService.cancelPending((await orderOf(payment)).id);
}

/** Refunded: the order is refunded, its unused tickets are canceled and their places freed. */
export async function onTicketsRefunded(payment: PaymentInfo): Promise<void> {
	const order = await orderOf(payment);
	if (!(await transactionsService.markRefunded(order.id))) return;
	const tickets = await ticketsService.getByTransactionId(order.id);
	const scannedByProduct = new Map<string, number>();
	for (const ticket of tickets)
		if (ticket.scannedAt)
			scannedByProduct.set(
				ticket.productId,
				(scannedByProduct.get(ticket.productId) ?? 0) + 1,
			);
	await ticketsService.deleteUnscannedByTransactionId(order.id);
	for (const item of await transactionsService.itemsOf(order.id)) {
		const freed = item.quantity - (scannedByProduct.get(item.productId) ?? 0);
		if (freed > 0) await productsService.decrementSold(item.productId, freed);
	}
}

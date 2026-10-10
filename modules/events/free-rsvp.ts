import { and, eq, inArray, isNull, like } from "drizzle-orm";
import { db } from "~/core-api";
import { products as productsTable } from "./schema/products";
import { tickets } from "./schema/tickets";
import { transactions } from "./schema/transactions";
import { productsService } from "./services/products";
import { ticketsService } from "./services/tickets";

/** Server-only: import from actions only, never from components. */

async function getSingleFreeRsvpProduct(eventId: string) {
	const rows = await db
		.select()
		.from(productsTable)
		.where(eq(productsTable.eventId, eventId))
		.limit(2);

	if (rows.length !== 1) return null;
	const [product] = rows;
	return product.price === 0 ? product : null;
}

/** Keeps the free RSVP ticket of an event in line with the visitor's yes/maybe/no answer. */
export async function syncFreeRsvpTicketForStatus(
	eventId: string,
	userId: string,
	status: "yes" | "no" | "maybe",
	productId?: string,
) {
	let freeProduct = null;

	if (productId) {
		const product = await productsService.getById(productId);
		if (product && product.eventId === eventId && product.price === 0) {
			freeProduct = product;
		}
	}

	if (!freeProduct) {
		freeProduct = await getSingleFreeRsvpProduct(eventId);
	}

	if (!freeProduct) return;

	const existingTickets = await db
		.select({
			id: tickets.id,
			transactionId: tickets.transactionId,
			stripeSessionId: transactions.stripeSessionId,
		})
		.from(tickets)
		.innerJoin(transactions, eq(tickets.transactionId, transactions.id))
		.where(
			and(
				eq(tickets.productId, freeProduct.id),
				eq(tickets.eventId, eventId),
				eq(tickets.buyerId, userId),
				isNull(tickets.scannedAt),
			),
		);

	if (status === "no") {
		const freeTickets = existingTickets.filter((ticket) =>
			ticket.stripeSessionId.startsWith("free_"),
		);

		if (freeTickets.length > 0) {
			const ticketIds = freeTickets.map((ticket) => ticket.id);
			const txIds = freeTickets.map((ticket) => ticket.transactionId);

			await db.delete(tickets).where(inArray(tickets.id, ticketIds));
			await db
				.delete(transactions)
				.where(
					and(
						inArray(transactions.id, txIds),
						like(transactions.stripeSessionId, "free_%"),
					),
				);

			await productsService.decrementSold(freeProduct.id, freeTickets.length);
		}
		return;
	}

	if (existingTickets.length === 0) {
		await ticketsService.createFreeTicket({
			productId: freeProduct.id,
			eventId,
			buyerId: userId,
		});
		await productsService.incrementSold(freeProduct.id, 1);
	}
}

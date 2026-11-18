import { getAppUrl, itemRef, payments, publicImageUrlFromKey } from "~/core";
import type { PendingParticipants } from "../schema/transactions";
import { productsService } from "./products";
import { transactionsService } from "./transactions";

/** Absolute URL of a product image for the provider's checkout page. */
function absoluteImageUrlFromKey(key: string | null): string | undefined {
	const path = publicImageUrlFromKey(key);
	return path ? new URL(path, getAppUrl()).toString() : undefined;
}

/**
 * Starts a paid ticket checkout (spec 4.7): a pending order and its core payment. Prices are
 * read from the products here, whatever the caller (or the request) had; nothing is reserved
 * until the payment arrives (`payments.ts`). Server-only.
 */
export async function startTicketPayment(params: {
	eventId: string;
	/** The event's canonical URL; the buyer returns to its checkout page. */
	eventUrl: string;
	userId: string;
	items: Array<{
		productId: string;
		quantity: number;
		participantUnits: PendingParticipants["participantUnits"];
	}>;
}): Promise<{ paymentId: string; url: string }> {
	const lines = await Promise.all(
		params.items.map(async (item) => {
			const product = await productsService.getById(item.productId);
			if (!product || product.eventId !== params.eventId)
				throw new Error(`Product ${item.productId} not found`);
			return { item, product };
		}),
	);
	const order = await transactionsService.createPending({
		eventId: params.eventId,
		userId: params.userId,
		items: lines.map(({ item, product }) => ({
			productId: product.id,
			quantity: item.quantity,
			unitPrice: product.price,
		})),
		participants: params.items.map((item) => ({
			productId: item.productId,
			participantUnits: item.participantUnits,
		})),
	});
	const checkoutPath = `${params.eventUrl}/checkout`;
	let payment: { id: string; url: string };
	try {
		payment = await payments.create(
			{ module: "events" },
			{
				kind: "tickets",
				refId: order.id,
				userId: params.userId,
				lines: lines.map(({ item, product }) => ({
					label: product.name,
					amount: Math.round(product.price * 100),
					quantity: item.quantity,
					description: product.features.join(", ") || undefined,
					imageUrl: absoluteImageUrlFromKey(product.imageKey),
				})),
				successPath: checkoutPath,
				cancelPath: `${checkoutPath}?canceled=1`,
				subjectRef: itemRef("events", "event", params.eventId),
			},
		);
	} catch (error) {
		// No checkout: the pending order can never be paid.
		await transactionsService.deletePending(order.id);
		throw error;
	}
	await transactionsService.setPaymentId(order.id, payment.id);
	return { paymentId: payment.id, url: payment.url };
}

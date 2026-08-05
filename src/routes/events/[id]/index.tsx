import { component$ } from "@qwik.dev/core";
import {
	type DocumentHead,
	type RequestHandler,
	routeAction$,
	routeLoader$,
	z,
	zod$,
} from "@qwik.dev/router";
import { and, eq, inArray, isNull, like } from "drizzle-orm";
import { db } from "~/db/connection";
import { groupMemberships } from "~/db/schemas/group-memberships";
import { groupRepresentatives } from "~/db/schemas/group-representatives";
import { groups as groupsTable } from "~/db/schemas/groups";
import { products as productsTable } from "~/db/schemas/products";
import { tickets } from "~/db/schemas/tickets";
import { transactions } from "~/db/schemas/transactions";
import { eventsService } from "~/services/events.service";
import { participationService } from "~/services/participation.service";
import { productsService } from "~/services/products.service";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/utils/images";
import { canonicalUrl, htmlToDescription } from "~/utils/seo";
import { getCurrentUserData } from "~/utils/server-auth";
import { buildProfileUrl, formatUser } from "~/utils/users";
import { EventView } from "~theme/routes/events/EventView";

export const onGet: RequestHandler = ({ cacheControl }) => {
	cacheControl({ noCache: true });
};

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

async function syncFreeRsvpTicketForStatus(
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

	const { ticketsService } = await import("~/services/tickets.service");
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

export const useEvent = routeLoader$(async (requestEvent) => {
	const { params, status } = requestEvent;
	const event = await eventsService.getById(params.id);

	if (!event) {
		status(404);
		return null;
	}

	// Get inventory groups with products
	const groups = (await db.query.inventoryGroups.findMany({
		where: { eventId: params.id },
		with: {
			products: true,
		},
	})) as unknown as Array<{
		id: string;
		name: string;
		maxCapacity: number;
		salesStartDate: string | null;
		salesEndDate: string | null;
		products: Array<{
			id: string;
			name: string;
			price: number;
			maxQuantity: number;
			participantCapacity: number;
			features: string[];
			imageKey: string | null;
			soldQuantity: number;
		}>;
	}>;

	// Check sales period status
	const salesValidation = await eventsService.validateSalesPeriod(event);

	// Get participation status if user is logged in
	const userData = await getCurrentUserData(requestEvent);
	const isLoggedIn = !!userData;
	let participationStatus = null;
	let hasAttended = false;
	let hasUserTicket = false;
	if (userData) {
		participationStatus = await participationService.getStatus(
			userData.id,
			params.id,
		);

		const userTicket = await db.query.tickets.findFirst({
			where: {
				eventId: params.id,
				buyerId: userData.id,
			},
		});
		hasUserTicket = !!userTicket;

		const scannedTicket = await db.query.tickets.findFirst({
			where: {
				eventId: params.id,
				buyerId: userData.id,
				scannedAt: { isNotNull: true },
			},
		});
		hasAttended = !!scannedTicket;
	}

	// Participation summary
	const participationSummary = await participationService.getSummary(params.id);

	// Fetch participants (yes / maybe) with profile pictures and group info
	const participationRows = (await db.query.participationStatus.findMany({
		where: { eventId: params.id },
		with: { user: true },
	})) as unknown as Array<{
		status: "yes" | "no" | "maybe";
		userId: string;
		user: {
			id: string;
			name: string;
			familyName: string;
			profilePicture: string | null;
			profilePictureSmall: string | null;
			city: string | null;
			country: string | null;
		};
	}>;

	const goingRows = participationRows.filter(
		(r) => r.status === "yes" || r.status === "maybe",
	);
	const participantUserIds = goingRows.map((r) => r.userId);

	// Build a map userId → group role label (e.g. "Local Rep Berlin")
	const userGroupLabels: Record<string, string> = {};

	if (participantUserIds.length > 0) {
		// Get representative status
		const repRows = await db
			.select({
				userId: groupRepresentatives.userId,
				groupId: groupRepresentatives.groupId,
				groupName: groupsTable.name,
			})
			.from(groupRepresentatives)
			.innerJoin(groupsTable, eq(groupRepresentatives.groupId, groupsTable.id))
			.where(inArray(groupRepresentatives.userId, participantUserIds));

		for (const rep of repRows) {
			userGroupLabels[rep.userId] = `Local Rep ${rep.groupName}`;
		}

		// For users that aren't representatives, fall back to their group membership
		const missingUsers = participantUserIds.filter(
			(id) => !userGroupLabels[id],
		);
		if (missingUsers.length > 0) {
			const memberRows = await db
				.select({
					userId: groupMemberships.userId,
					groupName: groupsTable.name,
				})
				.from(groupMemberships)
				.innerJoin(groupsTable, eq(groupMemberships.groupId, groupsTable.id))
				.where(inArray(groupMemberships.userId, missingUsers));

			for (const mem of memberRows) {
				if (!userGroupLabels[mem.userId]) {
					userGroupLabels[mem.userId] = mem.groupName;
				}
			}
		}
	}

	const buildPicUrl = (s3Key: string | null) => publicImageUrlFromKey(s3Key);

	const participantsUnsorted = goingRows.map((r) => {
		const u = r.user;
		return {
			id: u.id,
			name: u.name as string,
			familyName: u.familyName as string,
			profilePictureSmall: buildPicUrl(
				u.profilePicture
					? (u.profilePictureSmall ?? deriveThumbnailKey(u.profilePicture))
					: null,
			),
			groupLabel: userGroupLabels[u.id] ?? null,
			city: (u.city ?? null) as string | null,
			country: (u.country ?? null) as string | null,
			profileUrl: buildProfileUrl({
				id: u.id,
				name: u.name as string,
				familyName: u.familyName as string,
			}),
		};
	});

	// Shuffle helper (Fisher-Yates)
	const shuffle = <T,>(arr: T[]): T[] => {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	};

	// Prioritise users who have a profile picture, shuffle within each group
	const withPic = shuffle(
		participantsUnsorted.filter((p) => p.profilePictureSmall),
	);
	const withoutPic = shuffle(
		participantsUnsorted.filter((p) => !p.profilePictureSmall),
	);
	const participants = [...withPic, ...withoutPic];

	// Calculate event ticket info
	const now = new Date();
	const eventStart = new Date(event.startDate);
	const eventEnd = new Date(event.endDate);
	const isEventPast = now > eventEnd;
	const isEventFuture = now < eventStart;

	const allProducts = groups.flatMap((g) => g.products);
	const isFreeEvent =
		allProducts.length > 0 && allProducts.every((p) => p.price === 0);
	const hasSingleProduct = allProducts.length === 1;

	let activeSalesPeriod = false;
	let futureSalesPeriod = false;
	let pastSalesPeriod = false;
	let soldOut = false;

	for (const group of groups) {
		const salesStart = group.salesStartDate
			? new Date(group.salesStartDate)
			: null;
		const salesEnd = group.salesEndDate ? new Date(group.salesEndDate) : null;

		const withinWindow =
			(!salesStart || salesStart <= now) && (!salesEnd || salesEnd >= now);

		if (salesStart && salesStart > now) {
			futureSalesPeriod = true;
		}

		if (salesEnd && salesEnd < now) {
			pastSalesPeriod = true;
		}

		const soldQuantity =
			group.products?.reduce((sum, p) => sum + (p.soldQuantity || 0), 0) || 0;
		const remainingCapacity = group.maxCapacity - soldQuantity;

		if (withinWindow && remainingCapacity > 0) {
			activeSalesPeriod = true;
		}

		if (remainingCapacity <= 0) {
			soldOut = true;
		}
	}

	// Build a static map URL if we have coordinates
	let mapImageUrl: string | null = null;
	if (event.latitude && event.longitude) {
		const lat = event.latitude;
		const lon = event.longitude;
		mapImageUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=10&size=600x600&maptype=mapnik&markers=${lat},${lon},red-pushpin`;
	}

	// Location display string
	const locationDisplay =
		[event.city, event.country].filter(Boolean).join(", ") ||
		event.address ||
		(event.locationType === "online" ? "Online" : "");

	return {
		...event,
		user: formatUser(event.user, isLoggedIn),
		salesStatus: salesValidation,
		userParticipation: participationStatus,
		products: allProducts,
		isFreeEvent,
		hasSingleProduct,
		activeSalesPeriod,
		futureSalesPeriod,
		pastSalesPeriod,
		soldOut,
		isEventPast,
		isEventFuture,
		hasAttended,
		hasUserTicket,
		isLoggedIn,
		participationSummary,
		mapImageUrl,
		locationDisplay,
		participants,
		image1: publicImageUrlFromKey(event.image1),
		image2: publicImageUrlFromKey(event.image2),
	};
});

export const useUpdateParticipation = routeAction$(
	async (data, event) => {
		const userData = await getCurrentUserData(event);
		if (!userData) {
			return event.fail(401, { message: "Please log in to RSVP" });
		}

		await participationService.upsert(
			userData.id,
			event.params.id,
			data.status,
		);

		await syncFreeRsvpTicketForStatus(
			event.params.id,
			userData.id,
			data.status,
			data.productId,
		);

		if (data.status === "yes" && data.productId) {
			const ticket = await db.query.tickets.findFirst({
				where: {
					productId: data.productId,
					eventId: event.params.id,
					buyerId: userData.id,
				},
			});

			// Send confirmation email for free RSVP ticket creation.
			if (ticket)
				try {
					const userEmail = userData.email;
					if (userEmail) {
						const { emailNotificationsService } = await import(
							"~/services/email-notifications.service"
						);

						const [ev, product] = await Promise.all([
							eventsService.getById(event.params.id),
							productsService.getById(data.productId),
						]);

						if (ev && product) {
							await emailNotificationsService.sendTicketConfirmation({
								to: userEmail,
								buyerName: userData.name || userEmail,
								event: {
									title: ev.title,
									startDate: ev.startDate,
									address: ev.address,
									onlineUrl: ev.onlineUrl,
								},
								transactionId: ticket.transactionId || ticket.id,
								products: [{ name: product.name, quantity: 1, amount: 0 }],
								totalAmount: 0,
								tickets: [{ id: ticket.id, qrCodeUuid: ticket.qrCodeUuid }],
							});
						}
					}
				} catch (error) {
					console.error("Failed to send RSVP confirmation email:", error);
					// Don't fail the RSVP if email sending fails
				}
		}

		// No redirect: the client only reads a routeAction$'s embedded "redirect"
		// instruction when the underlying fetch response is an actual HTTP redirect
		// (response.redirected) — for an SPA action POST resolved with a 303 to the
		// same page, Qwik's client returns the parsed { redirect } field but never
		// consumes it, so the UI never updates. Return success and let the
		// automatic post-action loader invalidation (see vite.config.ts
		// strictLoaders: false) refresh useEvent() in place instead.
		return { success: true };
	},
	zod$({
		status: z.enum(["yes", "no", "maybe"]),
		productId: z.string().optional(),
	}),
);

export default component$(() => {
	const event = useEvent();
	const updateParticipation = useUpdateParticipation();
	return (
		<EventView event={event.value} updateParticipation={updateParticipation} />
	);
});

export const head: DocumentHead = ({ resolveValue, url }) => {
	const event = resolveValue(useEvent);

	if (!event) {
		return {
			title: "Event Not Found",
		};
	}

	const canonical = canonicalUrl(url.pathname, url.origin);
	const description = htmlToDescription(event.body) || `Event: ${event.title}`;

	return {
		title: `${event.title} - Event`,
		meta: [
			{ name: "description", content: description },
			{ property: "og:type", content: "event" },
			{ property: "og:title", content: event.title },
			{ property: "og:description", content: description },
			{ property: "og:url", content: canonical },
			...(event.image1
				? [{ property: "og:image", content: event.image1 }]
				: []),
		],
		links: [{ rel: "canonical", href: canonical }],
		scripts: [
			{
				type: "application/ld+json",
				script: JSON.stringify({
					"@context": "https://schema.org",
					"@type": "Event",
					name: event.title,
					startDate: event.startDate,
					endDate: event.endDate,
					eventAttendanceMode:
						event.locationType === "online"
							? "https://schema.org/OnlineEventAttendanceMode"
							: "https://schema.org/OfflineEventAttendanceMode",
					location:
						event.locationType === "online"
							? {
									"@type": "VirtualLocation",
									url: event.onlineUrl ?? canonical,
								}
							: {
									"@type": "Place",
									name: event.locationDisplay || event.title,
									address: event.address ?? event.locationDisplay ?? undefined,
								},
					image: event.image1 ?? undefined,
					description,
				}),
			},
		],
	};
};

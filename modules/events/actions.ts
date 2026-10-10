import { routeAction$, z, zod$ } from "@qwik.dev/router";
import {
	db,
	getCurrentUserData,
	getServerSession,
	requireActiveModule,
	requireModuleAuth,
	usersService,
} from "~/core";
import type {
	CheckoutItemInput,
	ParticipantSlotInput,
} from "~theme/routes/events/checkout/types";
import { syncFreeRsvpTicketForStatus } from "./free-rsvp";
import { isValidEmail } from "./participant-validation";
import { canViewEvent, eventIdOf } from "./public-event";
import { checkoutService } from "./services/checkout";
import { eventsService } from "./services/events";
import { participantsService } from "./services/participants";
import { participationService } from "./services/participation";
import { photosService } from "./services/photos";
import { productsService } from "./services/products";
import { stripeService } from "./services/stripe";
import { ticketsService } from "./services/tickets";

function splitIntoChunks(value: string, maxChunkSize = 450): string[] {
	if (!value) return [];
	const chunks: string[] = [];
	for (let i = 0; i < value.length; i += maxChunkSize) {
		chunks.push(value.slice(i, i + maxChunkSize));
	}
	return chunks;
}

export const useUpdateParticipation = routeAction$(
	async (data, event) => {
		const userData = await getCurrentUserData(event);
		if (!userData) {
			return event.fail(401, { message: "Please log in to RSVP" });
		}
		requireActiveModule(event, "events");

		const eventId = eventIdOf(event, "/events/:id");
		const target = eventId ? await eventsService.getById(eventId) : undefined;
		if (!eventId || !target || !(await canViewEvent(target, userData))) {
			return event.fail(404, { message: "Event not found" });
		}

		await participationService.upsert(userData.id, eventId, data.status);

		await syncFreeRsvpTicketForStatus(
			eventId,
			userData.id,
			data.status,
			data.productId,
		);

		if (data.status === "yes" && data.productId) {
			const ticket = await db.query.tickets.findFirst({
				where: {
					productId: data.productId,
					eventId,
					buyerId: userData.id,
				},
			});

			// Send confirmation email for free RSVP ticket creation.
			if (ticket)
				try {
					const userEmail = userData.email;
					if (userEmail) {
						const { sendTicketConfirmation } = await import("./emails");

						const product = await productsService.getById(data.productId);

						if (product) {
							await sendTicketConfirmation({
								to: userEmail,
								buyerName: userData.name || userEmail,
								event: {
									title: target.title,
									startDate: target.startDate,
									address: target.address,
									onlineUrl: target.onlineUrl,
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
		// strictLoaders: false) refresh the page data in place instead.
		return { success: true };
	},
	zod$({
		status: z.enum(["yes", "no", "maybe"]),
		productId: z.string().optional(),
	}),
);

export const useCreateCheckoutSession = routeAction$(
	async (data, event) => {
		// Check authentication for checkout
		const user = await getServerSession(event);
		if (!user) {
			return event.fail(401, { message: "Please log in to purchase tickets" });
		}
		requireActiveModule(event, "events");

		const eventId = eventIdOf(event, "/events/:id/checkout");
		const eventData = eventId
			? await eventsService.getById(eventId)
			: undefined;
		if (!eventId || !eventData || !(await canViewEvent(eventData, user))) {
			return event.fail(404, { message: "Event not found" });
		}

		// Validate sales period
		const salesValidation = await eventsService.validateSalesPeriod(eventData);
		if (!salesValidation.valid) {
			return event.fail(400, {
				message: salesValidation.reason || "Sales are not currently available",
			});
		}

		let parsedItems: CheckoutItemInput[];
		try {
			parsedItems = JSON.parse(data.items as string) as CheckoutItemInput[];
		} catch {
			return event.fail(400, { message: "Invalid cart" });
		}
		if (!Array.isArray(parsedItems)) {
			return event.fail(400, { message: "Invalid cart" });
		}
		const items = parsedItems
			.map((item) => ({
				productId: item.productId,
				quantity: Number(item.quantity),
				participantUnits: item.participantUnits ?? [],
			}))
			.filter(
				(item) =>
					item.productId && Number.isFinite(item.quantity) && item.quantity > 0,
			);

		if (items.length === 0) {
			return event.fail(400, { message: "Please select at least one ticket" });
		}

		// Validate inventory
		const validation = await checkoutService.validateInventory(eventId, items);
		if (!validation.valid) {
			return event.fail(400, { message: validation.errors.join("; ") });
		}

		// Get product details for line items
		const products = await Promise.all(
			items.map(async (item: any) => {
				const product = await productsService.getById(item.productId);
				return { ...item, product };
			}),
		);

		// Resolve emails for participant slots linked to an existing user. The search
		// API never exposes emails to the client, so the client-supplied email for a
		// linked slot is empty/untrusted — we look it up server-side from the id.
		const linkedUserIds = new Set<string>();
		for (const entry of products) {
			for (const unit of entry.participantUnits ?? []) {
				for (const slot of unit ?? []) {
					if (slot?.existingUserId) linkedUserIds.add(slot.existingUserId);
				}
			}
		}
		const linkedEmails = await usersService.getEmailsByIds([...linkedUserIds]);

		for (const entry of products) {
			if (!entry.product) {
				return event.fail(400, {
					message: `Product ${entry.productId} not found`,
				});
			}

			const expectedCapacity = Math.max(
				1,
				entry.product.participantCapacity || 1,
			);
			if (
				!Array.isArray(entry.participantUnits) ||
				entry.participantUnits.length !== entry.quantity
			) {
				return event.fail(400, {
					message: `Participant data is incomplete for ${entry.product.name}`,
				});
			}

			for (
				let unitIdx = 0;
				unitIdx < entry.participantUnits.length;
				unitIdx++
			) {
				const unit = entry.participantUnits[unitIdx] || [];
				if (unit.length !== expectedCapacity) {
					return event.fail(400, {
						message: `${entry.product.name} requires ${expectedCapacity} participant(s) per ticket`,
					});
				}

				for (let slotIdx = 0; slotIdx < unit.length; slotIdx++) {
					const slot = unit[slotIdx];
					const name = (slot?.name || "").trim();
					// For linked users the email comes from the DB, not the client.
					if (slot?.existingUserId) {
						const resolved = linkedEmails.get(slot.existingUserId);
						if (!resolved) {
							return event.fail(400, {
								message: `Invalid participant details for ${entry.product.name}, ticket ${unitIdx + 1}`,
							});
						}
						slot.email = resolved;
					}
					const email = (slot?.email || "").trim();
					if (!name || !email || !isValidEmail(email)) {
						return event.fail(400, {
							message: `Invalid participant details for ${entry.product.name}, ticket ${unitIdx + 1}`,
						});
					}
				}
			}
		}

		// First purchased ticket is always assigned to the buyer in slot 1.
		let firstTicketBound = false;
		const normalizedItems = products.map((entry) => {
			const normalizedUnits = entry.participantUnits.map(
				(unit: ParticipantSlotInput[]) =>
					unit.map((slot: ParticipantSlotInput) => ({
						name: (slot?.name || "").trim(),
						email: (slot?.email || "").trim().toLowerCase(),
						existingUserId: slot?.existingUserId || null,
					})),
			);

			for (let i = 0; i < normalizedUnits.length; i++) {
				if (firstTicketBound) break;
				if (normalizedUnits[i] && normalizedUnits[i][0]) {
					normalizedUnits[i][0] = {
						...normalizedUnits[i][0],
						name:
							[user.name, user.familyName].filter(Boolean).join(" ").trim() ||
							normalizedUnits[i][0].name,
						email:
							(user.email || "").trim().toLowerCase() ||
							normalizedUnits[i][0].email,
						existingUserId: user.id,
					};
					firstTicketBound = true;
				}
			}

			return {
				productId: entry.productId,
				quantity: entry.quantity,
				product: entry.product,
				participantUnits: normalizedUnits,
			};
		});

		// Calculate total amount
		const totalAmount = normalizedItems.reduce((sum, p) => {
			return sum + p.product.price * p.quantity * 100; // Convert to cents
		}, 0);

		// Handle free tickets - skip payment
		if (totalAmount === 0) {
			const createdTickets: any[] = [];
			for (const item of normalizedItems) {
				for (let i = 0; i < item.quantity; i++) {
					const ticket = await ticketsService.createFreeTicket({
						productId: item.productId,
						eventId,
						buyerId: user.id,
					});

					const participantSlots = item.participantUnits?.[i] || [];
					if (participantSlots.length > 0) {
						await participantsService.createBulk(
							participantSlots.map(
								(slot: ParticipantSlotInput, slotIdx: number) => ({
									ticketId: ticket.id,
									participantOrder: slotIdx + 1,
									name: slot.name,
									email: slot.email,
									userId: slot.existingUserId ?? null,
								}),
							),
						);
					}

					createdTickets.push(ticket);
				}
			}

			// Auto-upgrade participation status from "maybe" to "yes" for free tickets
			if (createdTickets.length > 0) {
				try {
					await participationService.autoUpgradeToYes(user.id, eventId);
				} catch (error) {
					console.error("Failed to auto-upgrade participation status:", error);
					// Don't fail the transaction if participation update fails
				}
			}

			return {
				tickets: createdTickets,
			};
		}

		// Build line items for Stripe
		const participantPayload = JSON.stringify(
			normalizedItems.map((item) => ({
				productId: item.productId,
				participantUnits: item.participantUnits,
			})),
		);
		const participantChunks = splitIntoChunks(participantPayload);

		const metadata: Record<string, string> = {
			// Routes the Stripe webhook to the events module's `payments.tickets` handlers.
			moduleId: "events",
			kind: "tickets",
			eventId,
			userId: user.id,
			items: JSON.stringify(
				normalizedItems.map((item) => ({
					productId: item.productId,
					quantity: item.quantity,
				})),
			),
			participantsChunkCount: String(participantChunks.length),
		};

		participantChunks.forEach((chunk, idx) => {
			metadata[`participantsChunk${idx}`] = chunk;
		});

		// Create Payment Intent directly
		const paymentIntent = await stripeService.stripe.paymentIntents.create({
			amount: Math.round(totalAmount),
			currency: "eur",
			metadata,
			automatic_payment_methods: {
				enabled: true,
			},
		});

		console.log("[Server] Payment Intent created:", paymentIntent.id);

		return {
			clientSecret: paymentIntent.client_secret,
			paymentIntentId: paymentIntent.id,
		};
	},
	zod$({ items: z.string() }),
);

export const useCheckPaymentStatus = routeAction$(
	async (data, event) => {
		await requireModuleAuth(event, "events");

		console.log("[Server] useCheckPaymentStatus called");

		try {
			const paymentIntent = await stripeService.stripe.paymentIntents.retrieve(
				data.payment_intent_id,
			);

			console.log("[Server] Payment Intent status:", paymentIntent.status);

			return {
				status: paymentIntent.status,
				succeeded: paymentIntent.status === "succeeded",
			};
		} catch (error: any) {
			console.error("[Server] Error retrieving payment intent:", error);
			return event.fail(400, {
				message: error.message || "Failed to retrieve payment status",
			});
		}
	},
	zod$({ payment_intent_id: z.string() }),
);

export const useGenerateSecureUrl = routeAction$(
	async (data, event) => {
		const user = await getServerSession(event);
		if (!user) {
			return event.fail(401, { message: "Not authenticated" });
		}
		requireActiveModule(event, "events");

		// Attendance of the photo's event is checked inside the service.
		const result = await photosService.generateSecureUrl(data.photoId, user.id);

		if (!result) {
			return event.fail(403, {
				message: "Cannot access this photo. You must have attended the event.",
			});
		}

		return {
			success: true,
			url: result.url,
			expiresAt: result.expiresAt,
		};
	},
	zod$({
		photoId: z.string().uuid(),
	}),
);

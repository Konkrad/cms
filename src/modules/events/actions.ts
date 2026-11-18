import { routeAction$, z, zod$ } from "@qwik.dev/router";
import {
	itemUrl,
	notify,
	payments,
	requireModuleAuth,
	requirements,
	t,
	usersService,
} from "~/core";
import type {
	CheckoutItemInput,
	ParticipantSlotInput,
} from "~theme/routes/events/checkout/types";
import type { TicketConfirmationData } from "./emails";
import { isValidEmail } from "./participant-validation";
import { canViewEvent, eventIdOf } from "./public-event";
import { CHECKOUT_CONTEXT } from "./requirements";
import { checkoutService } from "./services/checkout";
import { eventsService } from "./services/events";
import { syncFreeRsvpTicketForStatus } from "./services/free-rsvp";
import { participantsService } from "./services/participants";
import { participationService } from "./services/participation";
import { photosService } from "./services/photos";
import { productsService } from "./services/products";
import { startTicketPayment } from "./services/ticket-checkout";
import { ticketsService } from "./services/tickets";

export const useUpdateParticipation = routeAction$(
	async (data, event) => {
		const userData = await requireModuleAuth(event, "events");

		const eventId = await eventIdOf(event, "/events/:slug");
		const target = eventId ? await eventsService.getById(eventId) : undefined;
		if (!eventId || !target || !(await canViewEvent(target, userData))) {
			return event.fail(404, { message: t("events.actions.eventNotFound") });
		}

		// Registering needs the event requirements (spec 4.6); never trust the page for it.
		if (
			data.status === "yes" &&
			(await requirements.pending(userData, CHECKOUT_CONTEXT)).length > 0
		) {
			return event.fail(400, {
				message: t("events.actions.answerQuestionsBeforeRegistering"),
			});
		}

		await participationService.upsert(userData.id, eventId, data.status);

		await syncFreeRsvpTicketForStatus(
			eventId,
			userData.id,
			data.status,
			data.productId,
		);

		if (data.status === "yes" && data.productId) {
			const ticket = await ticketsService.findByBuyer({
				productId: data.productId,
				eventId,
				buyerId: userData.id,
			});

			// Confirmation email for the free RSVP ticket (queued; the worker sends it).
			const product = ticket
				? await productsService.getById(data.productId)
				: undefined;
			if (ticket && product) {
				await notify("events.ticket-confirmation", {
					to: userData.id,
					data: {
						eventId,
						transactionId: ticket.transactionId || ticket.id,
						products: [{ name: product.name, quantity: 1, amount: 0 }],
						totalAmount: 0,
						ticketIds: [ticket.id],
					} satisfies TicketConfirmationData,
				});
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
		const user = await requireModuleAuth(event, "events");

		const eventId = await eventIdOf(event, "/events/:slug/checkout");
		const eventData = eventId
			? await eventsService.getById(eventId)
			: undefined;
		if (!eventId || !eventData || !(await canViewEvent(eventData, user))) {
			return event.fail(404, { message: t("events.actions.eventNotFound") });
		}

		// The buyer's requirements (food preference, photo consent) are checked on the server,
		// whatever the page showed (spec 4.6).
		if ((await requirements.pending(user, CHECKOUT_CONTEXT)).length > 0) {
			return event.fail(400, {
				message: t("events.actions.answerQuestionsBeforeBuying"),
			});
		}

		// Validate sales period
		const salesValidation = await eventsService.validateSalesPeriod(eventData);
		if (!salesValidation.valid) {
			return event.fail(400, {
				message:
					salesValidation.reason ||
					t("events.actions.salesAreNotCurrentlyAvailable"),
			});
		}

		let parsedItems: CheckoutItemInput[];
		try {
			parsedItems = JSON.parse(data.items as string) as CheckoutItemInput[];
		} catch {
			return event.fail(400, { message: t("events.actions.invalidCart") });
		}
		if (!Array.isArray(parsedItems)) {
			return event.fail(400, { message: t("events.actions.invalidCart") });
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
			return event.fail(400, {
				message: t("events.actions.pleaseSelectAtLeastOne"),
			});
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
					message: t("events.actions.participantDataIsIncompleteFor", {
						name: entry.product.name,
					}),
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
						message: t("events.actions.participantsPerTicket", {
							product: entry.product.name,
							count: expectedCapacity,
						}),
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
								message: t(
									"events.actions.invalidParticipantDetailsForTicket",
									{ name: entry.product.name, value: unitIdx + 1 },
								),
							});
						}
						slot.email = resolved;
					}
					const email = (slot?.email || "").trim();
					if (!name || !email || !isValidEmail(email)) {
						return event.fail(400, {
							message: t("events.actions.invalidParticipantDetailsForTicket", {
								name: entry.product.name,
								value: unitIdx + 1,
							}),
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

		// Paid: amounts come from the DB prices only (never from the request), spec 4.7.
		if (!payments.enabled()) {
			return event.fail(400, {
				message: t("events.actions.onlinePaymentIsNotAvailable"),
			});
		}
		const payment = await startTicketPayment({
			eventId,
			eventUrl: await itemUrl("events:event", eventData),
			userId: user.id,
			items: normalizedItems.map((item) => ({
				productId: item.productId,
				quantity: item.quantity,
				participantUnits: item.participantUnits,
			})),
		});

		// The browser goes to the provider's page; the result arrives by webhook only.
		return { checkoutUrl: payment.url, paymentId: payment.paymentId };
	},
	zod$({ items: z.string() }),
);

export const useGenerateSecureUrl = routeAction$(
	async (data, event) => {
		const user = await requireModuleAuth(event, "events");

		// Attendance of the photo's event is checked inside the service.
		const result = await photosService.generateSecureUrl(data.photoId, user.id);

		if (!result) {
			return event.fail(403, {
				message: t("events.actions.cannotAccessThisPhotoYou"),
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

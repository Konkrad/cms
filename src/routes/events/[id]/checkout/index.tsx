import { component$ } from "@qwik.dev/core";
import {
  routeLoader$,
  routeAction$,
  z,
  zod$,
} from "@qwik.dev/router";
// Import re-exported route actions via a RELATIVE path, not the "~"/"~theme" alias —
// qwikRouter's production transform for re-exported routeAction$/routeLoader$ does
// not resolve either tsconfig alias, so the Rollup build fails to find the module.
// The presentational FoodPreferenceStep/PhotoConsentStep widgets themselves (no
// actions) are imported by the theme view via the "~theme" alias.
import { useSaveFoodPreference } from "../../../../components/setup/FoodPreferenceStep/useSaveFoodPreference";
import { useSavePhotoConsent } from "../../../../components/setup/PhotoConsentStep/useSavePhotoConsent";
import { inventoryGroupsService } from "~/services/inventory-groups.service";
import { productsService } from "~/services/products.service";
import { usersService } from "~/services/users.service";
import { checkoutService } from "~/services/checkout.service";
import { stripeService } from "~/services/stripe.service";
import { publicImageUrlFromKey, deriveThumbnailKey } from "~/utils/images";
import { getServerSession } from "~/utils/server-auth";
import { isValidEmail } from "~/utils/participant-validation";
import { env } from "~/env";
import type {
  CheckoutItemInput,
  ParticipantSlotInput,
} from "~theme/routes/events/checkout/types";
import { CheckoutView } from "~theme/routes/events/CheckoutView";

export { useSaveFoodPreference, useSavePhotoConsent };

function splitIntoChunks(value: string, maxChunkSize = 450): string[] {
  if (!value) return [];
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += maxChunkSize) {
    chunks.push(value.slice(i, i + maxChunkSize));
  }
  return chunks;
}

export const useProductsData = routeLoader$(async (event) => {
  const eventId = event.params.id;

  // Get all inventory groups with products
  const groups = await inventoryGroupsService.getByEventId(eventId);

  const now = new Date();

  // Calculate remaining capacity, sales window and available products for each group
  const groupsWithCapacity = await Promise.all(
    groups.map(async (group: any) => {
      const soldQuantity =
        group.products?.reduce(
          (sum: number, p: any) => sum + (p.soldQuantity || 0),
          0,
        ) || 0;
      const remainingCapacity = group.maxCapacity - soldQuantity;

      const salesStart = group.salesStartDate
        ? new Date(group.salesStartDate)
        : null;
      const salesEnd = group.salesEndDate ? new Date(group.salesEndDate) : null;
      const isSalesOpen =
        (!salesStart || salesStart <= now) && (!salesEnd || salesEnd >= now);

      // Determine which products are currently available:
      // - group sales window must be open
      // - group must have remaining capacity
      // - product must have remaining quantity (or unlimited if maxQuantity === 0)
      const availableProducts = (group.products || []).filter((p: any) => {
        const productRemaining =
          p.maxQuantity && p.maxQuantity > 0
            ? p.maxQuantity - (p.soldQuantity || 0)
            : Infinity;
        return isSalesOpen && remainingCapacity > 0 && productRemaining > 0;
      });

      return {
        ...group,
        remainingCapacity,
        soldQuantity,
        isSalesOpen,
        availableProducts,
      };
    }),
  );

  const session = await getServerSession(event);

  return {
    eventId,
    groups: groupsWithCapacity,
    stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY,
    foodPreference: (session as any)?.foodPreference ?? null,
    photoConsentGiven: (session as any)?.photoConsentGiven ?? null,
    buyer: {
      id: (session as any)?.id ?? "",
      name: [
        (session as any)?.name,
        (session as any)?.familyName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
      email: (session as any)?.email ?? "",
      avatarUrl: (session as any)?.profilePicture
        ? publicImageUrlFromKey((session as any).profilePictureSmall ?? deriveThumbnailKey((session as any).profilePicture))
        : null,
    },
  };
});

export const useCreateCheckoutSession = routeAction$(
  async (data, event) => {
    const eventId = event.params.id;

    // Check authentication for checkout
    const user = await getServerSession(event);
    if (!user) {
      return event.fail(401, { message: "Please log in to purchase tickets" });
    }

    // Get event and validate sales period
    const { eventsService } = await import("~/services/events.service");
    const eventData = await eventsService.getById(eventId);
    if (!eventData) {
      return event.fail(404, { message: "Event not found" });
    }

    // Validate sales period
    const salesValidation = await eventsService.validateSalesPeriod(eventData);
    if (!salesValidation.valid) {
      return event.fail(400, {
        message: salesValidation.reason || "Sales are not currently available",
      });
    }

    const parsedItems = JSON.parse(data.items as string) as CheckoutItemInput[];
    const items = parsedItems
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        participantUnits: item.participantUnits ?? [],
      }))
      .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0);

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
        return event.fail(400, { message: `Product ${entry.productId} not found` });
      }

      const expectedCapacity = Math.max(1, entry.product.participantCapacity || 1);
      if (!Array.isArray(entry.participantUnits) || entry.participantUnits.length !== entry.quantity) {
        return event.fail(400, {
          message: `Participant data is incomplete for ${entry.product.name}`,
        });
      }

      for (let unitIdx = 0; unitIdx < entry.participantUnits.length; unitIdx++) {
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
      const normalizedUnits = entry.participantUnits.map((unit: ParticipantSlotInput[]) =>
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
            name: [user.name, user.familyName].filter(Boolean).join(" ").trim() || normalizedUnits[i][0].name,
            email: (user.email || "").trim().toLowerCase() || normalizedUnits[i][0].email,
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
      const { ticketsService } = await import("~/services/tickets.service");
      const { participantsService } = await import("~/services/participants.service");

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
              participantSlots.map((slot: ParticipantSlotInput, slotIdx: number) => ({
                ticketId: ticket.id,
                participantOrder: slotIdx + 1,
                name: slot.name,
                email: slot.email,
                userId: slot.existingUserId ?? null,
              })),
            );
          }

          createdTickets.push(ticket);
        }
      }

      // Auto-upgrade participation status from "maybe" to "yes" for free tickets
      if (createdTickets.length > 0) {
        const { participationService } =
          await import("~/services/participation.service");
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
    const lineItems = normalizedItems.map((p) => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: p.product.name,
            description: p.product.features?.join(", ") || "",
            images: p.product.imageKey ? [publicImageUrlFromKey(p.product.imageKey)].filter(Boolean) : [],
          },
          unit_amount: Math.round(p.product.price * 100), // Convert to cents
        },
        quantity: p.quantity,
      }));

    const participantPayload = JSON.stringify(
      normalizedItems.map((item) => ({
        productId: item.productId,
        participantUnits: item.participantUnits,
      })),
    );
    const participantChunks = splitIntoChunks(participantPayload);

    const metadata: Record<string, string> = {
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

export default component$(() => {
  const data = useProductsData();
  const createCheckoutSession = useCreateCheckoutSession();
  const checkPaymentStatus = useCheckPaymentStatus();
  const saveFood = useSaveFoodPreference();
  const savePhoto = useSavePhotoConsent();

  return (
    <CheckoutView
      data={data.value}
      createCheckoutSession={createCheckoutSession}
      checkPaymentStatus={checkPaymentStatus}
      saveFood={saveFood}
      savePhoto={savePhoto}
    />
  );
});

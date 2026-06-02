import type { RequestHandler } from "@qwik.dev/router";
import { stripeService } from "~/services/stripe.service";
import { transactionsService } from "~/services/transactions.service";
import { transactionItemsService } from "~/services/transaction-items.service";
import { ticketsService } from "~/services/tickets.service";
import { participantsService } from "~/services/participants.service";
import { productsService } from "~/services/products.service";
import { inventoryGroupsService } from "~/services/inventory-groups.service";
import { qrcodeService } from "~/services/qrcode.service";
import { telegramService } from "~/services/telegram.service";
import { icalService } from "~/services/ical.service";
import { emailNotificationsService } from "~/services/email-notifications.service";
import { env } from "~/env";
import Stripe from "stripe";
import { db } from "~/db/connection";
import { events } from "~/db/schemas/events";
import { users } from "~/db/schemas/users";
import { logins } from "~/db/schemas/logins";
import { eq } from "drizzle-orm";

export const onPost: RequestHandler = async ({
  request,
  json,
  error: errorHandler,
}) => {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    json(400, { error: "No signature" });
    return;
  }

  let stripeEvent: Stripe.Event;

  try {
    const body = await request.text();
    stripeEvent = stripeService.stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    json(400, { error: "Invalid signature" });
    return;
  }

  // Handle the event
  if (stripeEvent.type === "payment_intent.succeeded") {
    const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;

    try {
      await processPaymentIntent(paymentIntent);
      json(200, { received: true });
    } catch (error) {
      console.error("Failed to process payment intent:", error);
      json(500, { error: "Processing failed" });
    }
  } else {
    json(200, { received: true });
  }
};

async function processPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const { eventId, userId, items } = paymentIntent.metadata as {
    eventId: string;
    userId: string;
    items: string;
  };

  // Check for idempotency - if transaction already exists, skip
  const existingTransaction = await transactionsService.findByPaymentId(
    paymentIntent.id,
  );
  if (existingTransaction) {
    console.log(
      "Transaction already processed for payment intent:",
      paymentIntent.id,
    );
    return;
  }

  // Get event and user details
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const [login] = await db
    .select()
    .from(logins)
    .where(eq(logins.id, user?.loginId || ""))
    .limit(1);

  if (!event || !user) {
    throw new Error("Event or user not found");
  }

  const userEmail = login?.email || "";

  // Parse items
  const purchasedItems: Array<{ productId: string; quantity: number }> =
    JSON.parse(items);

  const participantChunkCount = Number(
    paymentIntent.metadata?.participantsChunkCount || "0",
  );
  const participantUnitsByProduct = new Map<string, Array<Array<{
    name: string;
    email: string;
    existingUserId?: string | null;
  }>>>();

  if (participantChunkCount > 0) {
    let payload = "";
    for (let idx = 0; idx < participantChunkCount; idx++) {
      payload += paymentIntent.metadata?.[`participantsChunk${idx}`] || "";
    }

    if (payload) {
      const parsed = JSON.parse(payload) as Array<{
        productId: string;
        participantUnits: Array<Array<{
          name: string;
          email: string;
          existingUserId?: string | null;
        }>>;
      }>;

      for (const entry of parsed) {
        participantUnitsByProduct.set(entry.productId, entry.participantUnits || []);
      }
    }
  }

  // Get product details for pricing
  const products = await Promise.all(
    purchasedItems.map(async (item) => {
      const product = await productsService.getById(item.productId);
      return { ...item, product };
    }),
  );

  // Calculate totals (amount is in cents)
  const totalAmount = paymentIntent.amount / 100;
  const calculatedAmount = products.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0,
  );
  const transactionFee = totalAmount - calculatedAmount;

  // Create transaction
  const transaction = await transactionsService.create({
    eventId,
    userId,
    totalAmount: calculatedAmount,
    transactionFee,
    stripeSessionId: `pi_${paymentIntent.id}`, // Use payment intent ID prefixed for uniqueness
    stripePaymentId: paymentIntent.id,
  });

  // Create transaction items
  await transactionItemsService.createBulk(
    products.map((item) => ({
      transactionId: transaction.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.product?.price || 0,
    })),
  );

  // Update inventory sold quantities
  await Promise.all(
    products.map((item) =>
      productsService.incrementSold(item.productId, item.quantity),
    ),
  );

  // Generate tickets for products that need them
  const ticketsToCreate: Array<{
    transactionId: string;
    productId: string;
    eventId: string;
    buyerId: string;
    participantSlots: Array<{
      name: string;
      email: string;
      existingUserId?: string | null;
    }>;
  }> = [];
  for (const item of products) {
    const inventoryGroup = await inventoryGroupsService.getById(
      item.product?.inventoryGroupId || "",
    );
    if (inventoryGroup?.needsTicket) {
      for (let i = 0; i < item.quantity; i++) {
        const participantUnits = participantUnitsByProduct.get(item.productId) || [];
        ticketsToCreate.push({
          transactionId: transaction.id,
          productId: item.productId,
          eventId,
          buyerId: userId,
          participantSlots: participantUnits[i] || [],
        });
      }
    }
  }

  const tickets =
    ticketsToCreate.length > 0
      ? await ticketsService.createBulk(
          ticketsToCreate.map((ticket) => ({
            transactionId: ticket.transactionId,
            productId: ticket.productId,
            eventId: ticket.eventId,
            buyerId: ticket.buyerId,
          })),
        )
      : [];

  for (let idx = 0; idx < tickets.length; idx++) {
    const createdTicket = tickets[idx];
    const participantSlots = ticketsToCreate[idx]?.participantSlots || [];
    if (participantSlots.length === 0) continue;

    await participantsService.createBulk(
      participantSlots.map((slot, slotIdx) => ({
        ticketId: createdTicket.id,
        participantOrder: slotIdx + 1,
        name: slot.name,
        email: slot.email,
        additionalData: slot.existingUserId
          ? { existingUserId: slot.existingUserId }
          : undefined,
      })),
    );
  }

  // Auto-upgrade participation status from "maybe" to "yes" on ticket purchase
  if (tickets.length > 0) {
    const { participationService } = await import("~/services/participation.service");
    try {
      await participationService.autoUpgradeToYes(userId, eventId);
    } catch (error) {
      console.error("Failed to auto-upgrade participation status:", error);
      // Don't fail the transaction if participation update fails
    }
  }

  // Generate QR codes for tickets
  const qrCodes = await Promise.all(
    tickets.map(async (ticket) => {
      const qrCodePng = await qrcodeService.generatePNG(ticket.qrCodeUuid);
      return {
        ticketId: ticket.id,
        qrCodeUuid: ticket.qrCodeUuid,
        qrCodePng,
      };
    }),
  );

  // Prepare email data
  const ticketsForEmail = tickets.map((ticket) => {
    const product = products.find((p) => p.productId === ticket.productId);
    return {
      id: ticket.id,
      qrCodeUuid: ticket.qrCodeUuid,
      productName: product?.product?.name || "Ticket",
    };
  });

  const productsForEmail = products
    .filter((p) => p.product)
    .map((p) => ({
      name: p.product!.name,
      quantity: p.quantity,
      amount: p.product!.price,
    }));

  // Generate iCal attachment
  const icsContent = icalService.generateEventIcs(event);

  // Send confirmation email
  try {
    await emailNotificationsService.sendTicketConfirmation({
      to: userEmail,
      buyerName: user.name || userEmail,
      event: {
        title: event.title,
        startDate: event.startDate,
        address: event.address,
        onlineUrl: event.onlineUrl,
      },
      transactionId: transaction.id,
      products: productsForEmail,
      totalAmount: calculatedAmount,
      tickets: ticketsForEmail.map((t) => ({ id: t.id, qrCodeUuid: t.qrCodeUuid })),
    });
    console.log("Confirmation email sent to:", userEmail);
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
    // Don't throw - continue with notifications
  }

  // Send Telegram notifications
  for (const item of products) {
    if (item.product) {
      try {
        const remainingInventory = await getRemainingInventory(
          item.product.inventoryGroupId,
        );
        await telegramService.sendNotification(
          `🎫 New sale: ${item.quantity}x ${item.product.name} (€${(item.product.price * item.quantity).toFixed(2)})\n` +
            `📊 Remaining: ${remainingInventory} spots`,
        );
      } catch (error) {
        console.error("Failed to send Telegram notification:", error);
        // Continue with other notifications
      }
    }
  }

  console.log("Payment intent processed successfully:", {
    transactionId: transaction.id,
    ticketsGenerated: tickets.length,
  });
}

async function getRemainingInventory(
  inventoryGroupId: string,
): Promise<number> {
  const { remainingCapacity } = await inventoryGroupsService.validatePurchase(
    inventoryGroupId,
    0,
  );
  return remainingCapacity;
}

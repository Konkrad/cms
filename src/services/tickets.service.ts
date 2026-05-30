import { db } from "~/db/connection";
import {
  tickets,
  insertTicketSchema,
  updateTicketSchema,
  type Ticket,
  type InsertTicket,
} from "~/db/schemas/tickets";
import { users } from "~/db/schemas/users";
import { products } from "~/db/schemas/products";
import { events } from "~/db/schemas/events";
import { ticketParticipants } from "~/db/schemas/ticket-participants";
import { eq, and, isNull, isNotNull, inArray } from "drizzle-orm";
import { transactions } from "~/db/schemas/transactions";
import { parseAndValidateQR } from "~/utils/qr-code";
import crypto from "crypto";

export const ticketsService = {
  async create(data: InsertTicket): Promise<Ticket> {
    const validated = insertTicketSchema.parse(data);
    const [ticket] = await db
      .insert(tickets)
      .values(validated as any)
      .returning();
    return ticket;
  },

  async createBulk(
    ticketData: Array<Omit<InsertTicket, "id" | "qrCodeUuid" | "createdAt">>,
  ): Promise<Ticket[]> {
    const validated = ticketData.map((data) => insertTicketSchema.parse(data));
    const result = await db
      .insert(tickets)
      .values(validated as any)
      .returning();
    return result;
  },

  async getById(id: string): Promise<
    | (Ticket & {
        buyer: typeof users.$inferSelect;
        product: typeof products.$inferSelect;
        event: typeof events.$inferSelect;
        participants: Array<typeof ticketParticipants.$inferSelect>;
      })
    | undefined
  > {
    const result = await db.query.tickets.findFirst({
      where: { id },
      with: {
        buyer: true,
        product: true,
        event: true,
        participants: {
          orderBy: { participantOrder: "asc" },
        },
      },
    });
    return result as any;
  },

  async rotateQrCode(ticketId: string): Promise<Ticket | undefined> {
    const [result] = await db
      .update(tickets)
      .set({ qrCodeUuid: crypto.randomUUID() })
      .where(eq(tickets.id, ticketId))
      .returning();
    return result;
  },

  async getByQrCodeUuid(qrCodeUuid: string): Promise<
    | (Ticket & {
        buyer: typeof users.$inferSelect;
        product: typeof products.$inferSelect;
        event: typeof events.$inferSelect;
      })
    | undefined
  > {
    const result = await db.query.tickets.findFirst({
      where: { qrCodeUuid },
      with: {
        buyer: true,
        product: true,
        event: true,
      },
    });
    return result as any;
  },

  async getByEventId(eventId: string): Promise<
    Array<
      Ticket & {
        buyer: typeof users.$inferSelect;
        product: typeof products.$inferSelect;
      }
    >
  > {
    const results = await db.query.tickets.findMany({
      where: { eventId },
      with: {
        buyer: true,
        product: true,
      },
    });
    return results as any;
  },

  async getByBuyerId(buyerId: string): Promise<
    Array<
      Ticket & {
        event: typeof events.$inferSelect;
        product: typeof products.$inferSelect;
        participants: Array<typeof ticketParticipants.$inferSelect>;
      }
    >
  > {
    const results = await db.query.tickets.findMany({
      where: { buyerId },
      with: {
        event: true,
        product: true,
        participants: {
          orderBy: { participantOrder: "asc" },
        },
      },
    });
    return results as any;
  },

  async scanTicket(
    qrDataString: string,
    eventId: string,
  ): Promise<
    | {
        success: true;
        ticket: Ticket;
        participants: Array<typeof ticketParticipants.$inferSelect>;
      }
    | { success: false; error: string }
  > {
    // Parse and validate QR code
    const qrResult = parseAndValidateQR(qrDataString);
    if (!qrResult.valid || !qrResult.data) {
      return { success: false, error: qrResult.error || "Invalid QR code" };
    }

    const { ticketId, eventId: qrEventId } = qrResult.data;

    // Verify event ID matches
    if (qrEventId !== eventId) {
      return { success: false, error: "QR code is for a different event" };
    }

    // Find the ticket with participants
    const currentTicket = await db.query.tickets.findFirst({
      where: { id: ticketId },
      with: {
        participants: {
          orderBy: { participantOrder: "asc" },
        },
      },
    });

    if (!currentTicket) {
      return { success: false, error: "Ticket not found" };
    }

    // Check if already scanned
    if (currentTicket.scannedAt) {
      return {
        success: false,
        error: `Ticket already scanned at ${currentTicket.scannedAt}`,
      };
    }

    // Update ticket as scanned
    const [ticket] = await db
      .update(tickets)
      .set({ scannedAt: new Date().toISOString() })
      .where(and(eq(tickets.id, ticketId), isNull(tickets.scannedAt)))
      .returning();

    if (!ticket) {
      return { success: false, error: "Failed to scan ticket" };
    }

    return {
      success: true,
      ticket,
      participants: currentTicket.participants as any,
    };
  },

  async getAttendanceStats(eventId: string): Promise<{
    totalTickets: number;
    scannedTickets: number;
    freeTickets: number;
    paidTickets: number;
    attendanceRate: number;
  }> {
    const allTickets = await db.query.tickets.findMany({
      where: { eventId },
      with: {
        product: true,
      },
    });

    const totalTickets = allTickets.length;
    const scannedTickets = allTickets.filter((t) => t.scannedAt).length;
    const freeTickets = allTickets.filter((t) => t.product.price === 0).length;
    const paidTickets = totalTickets - freeTickets;
    const attendanceRate =
      totalTickets > 0 ? (scannedTickets / totalTickets) * 100 : 0;

    return {
      totalTickets,
      scannedTickets,
      freeTickets,
      paidTickets,
      attendanceRate,
    };
  },

  async getAttendedTickets(eventId: string): Promise<
    Array<
      Ticket & {
        buyer: typeof users.$inferSelect;
        product: typeof products.$inferSelect;
        participants: Array<typeof ticketParticipants.$inferSelect>;
      }
    >
  > {
    const results = await db.query.tickets.findMany({
      where: {
        eventId,
        scannedAt: { isNotNull: true },
      },
      with: {
        buyer: true,
        product: true,
        participants: {
          orderBy: { participantOrder: "asc" },
        },
      },
    });
    return results as any;
  },

  async createFreeTicket(data: {
    productId: string;
    eventId: string;
    buyerId: string;
  }): Promise<Ticket> {
    // Create a dummy transaction for free tickets
    const { transactionsService } = await import("./transactions.service");
    const transaction = await transactionsService.create({
      userId: data.buyerId,
      eventId: data.eventId,
      totalAmount: 0,
      transactionFee: 0,
      stripeSessionId: `free_${crypto.randomUUID()}`,
      stripePaymentId: `free_${crypto.randomUUID()}`,
    });

    // Create the ticket
    const ticket = await this.create({
      transactionId: transaction.id,
      productId: data.productId,
      eventId: data.eventId,
      buyerId: data.buyerId,
    });

    return ticket;
  },

  async findUnscannedByBuyerEventProduct(data: {
    productId: string;
    eventId: string;
    buyerId: string;
  }): Promise<Ticket[]> {
    const results = await db.query.tickets.findMany({
      where: {
        productId: data.productId,
        eventId: data.eventId,
        buyerId: data.buyerId,
        scannedAt: null,
      },
    });
    return results as Ticket[];
  },

  async deleteFreeTicketsByIds(ticketIds: string[]): Promise<void> {
    if (ticketIds.length === 0) return;

    const rows = await db
      .select({
        ticketId: tickets.id,
        transactionId: transactions.id,
        stripeSessionId: transactions.stripeSessionId,
      })
      .from(tickets)
      .innerJoin(transactions, eq(tickets.transactionId, transactions.id))
      .where(inArray(tickets.id, ticketIds));

    for (const row of rows) {
      await db.delete(tickets).where(eq(tickets.id, row.ticketId));
      if (row.stripeSessionId.startsWith("free_")) {
        await db.delete(transactions).where(eq(transactions.id, row.transactionId));
      }
    }
  },
};

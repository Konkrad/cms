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
import { eq, and, isNull } from "drizzle-orm";

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
      })
    | undefined
  > {
    const result = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
      with: {
        buyer: true,
        product: true,
        event: true,
      },
    });
    return result as any;
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
      where: eq(tickets.qrCodeUuid, qrCodeUuid),
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
      where: eq(tickets.eventId, eventId),
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
      }
    >
  > {
    const results = await db.query.tickets.findMany({
      where: eq(tickets.buyerId, buyerId),
      with: {
        event: true,
        product: true,
      },
    });
    return results as any;
  },

  async scanTicket(qrCodeUuid: string): Promise<Ticket | undefined> {
    // First, check the current state of the ticket
    const currentTicket = await db.query.tickets.findFirst({
      where: eq(tickets.qrCodeUuid, qrCodeUuid),
    });

    console.log("scanTicket - Current ticket state:", {
      found: !!currentTicket,
      qrCodeUuid,
      currentScannedAt: currentTicket?.scannedAt,
      scannedAtType: typeof currentTicket?.scannedAt,
      scannedAtValue:
        currentTicket?.scannedAt === null
          ? "NULL"
          : currentTicket?.scannedAt === ""
            ? "EMPTY_STRING"
            : currentTicket?.scannedAt,
    });

    if (!currentTicket) {
      console.error("scanTicket - Ticket not found");
      return undefined;
    }

    if (currentTicket.scannedAt) {
      console.error("scanTicket - Ticket already scanned");
      return undefined;
    }

    // Try to update the ticket
    const [ticket] = await db
      .update(tickets)
      .set({ scannedAt: new Date().toISOString() })
      .where(and(eq(tickets.qrCodeUuid, qrCodeUuid), isNull(tickets.scannedAt)))
      .returning();

    console.log("scanTicket - Update result:", {
      updated: !!ticket,
      ticketId: ticket?.id,
    });

    return ticket;
  },
};

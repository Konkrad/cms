import { db } from "~/db/connection";
import {
  ticketParticipants,
  insertTicketParticipantSchema,
  type TicketParticipant,
  type InsertTicketParticipant,
} from "~/db/schemas/ticket-participants";
import { eq } from "drizzle-orm";

export const participantsService = {
  async create(data: InsertTicketParticipant): Promise<TicketParticipant> {
    const validated = insertTicketParticipantSchema.parse(data);
    const [participant] = await db
      .insert(ticketParticipants)
      .values(validated as any)
      .returning();
    return participant;
  },

  async createBulk(
    participants: InsertTicketParticipant[],
  ): Promise<TicketParticipant[]> {
    const validated = participants.map((p) =>
      insertTicketParticipantSchema.parse(p),
    );
    const result = await db
      .insert(ticketParticipants)
      .values(validated as any)
      .returning();
    return result;
  },

  async getByTicketId(ticketId: string): Promise<TicketParticipant[]> {
    const results = await db.query.ticketParticipants.findMany({
      where: { ticketId },
      orderBy: { participantOrder: "asc" },
    });
    return results;
  },

  async getById(id: string): Promise<TicketParticipant | undefined> {
    const result = await db.query.ticketParticipants.findFirst({
      where: { id },
    });
    return result;
  },

  async update(
    id: string,
    data: Partial<InsertTicketParticipant>,
  ): Promise<TicketParticipant | undefined> {
    const [result] = await db
      .update(ticketParticipants)
      .set(data as any)
      .where(eq(ticketParticipants.id, id))
      .returning();
    return result;
  },

  async delete(id: string): Promise<void> {
    await db.delete(ticketParticipants).where(eq(ticketParticipants.id, id));
  },

  async deleteByTicketId(ticketId: string): Promise<void> {
    await db
      .delete(ticketParticipants)
      .where(eq(ticketParticipants.ticketId, ticketId));
  },

  async validateParticipantCount(
    ticketId: string,
    expectedCapacity: number,
  ): Promise<{ valid: boolean; error?: string }> {
    const participants = await this.getByTicketId(ticketId);
    
    if (participants.length !== expectedCapacity) {
      return {
        valid: false,
        error: `Expected ${expectedCapacity} participants, found ${participants.length}`,
      };
    }

    // Validate participant orders are sequential (1, 2, 3, ...)
    const orders = participants.map((p) => p.participantOrder).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        return {
          valid: false,
          error: `Participant orders must be sequential starting from 1`,
        };
      }
    }

    return { valid: true };
  },
};

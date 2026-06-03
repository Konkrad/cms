import { db } from "~/db/connection";
import {
  ticketParticipants,
  insertTicketParticipantSchema,
  type TicketParticipant,
  type InsertTicketParticipant,
} from "~/db/schemas/ticket-participants";
import { logins } from "~/db/schemas/logins";
import { users } from "~/db/schemas/users";
import type { tickets } from "~/db/schemas/tickets";
import type { events } from "~/db/schemas/events";
import type { products } from "~/db/schemas/products";
import { eq, inArray } from "drizzle-orm";

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

  /**
   * Replace all participants for a ticket with a new ordered list.
   * Looks up each email against registered users and sets userId where matched.
   * Participants with no name/email are skipped (empty slots).
   */
  async replaceForTicket(
    ticketId: string,
    slots: Array<{ name: string; email: string }>,
  ): Promise<TicketParticipant[]> {
    await this.deleteByTicketId(ticketId);

    const nonEmpty = slots.filter((s) => s.name.trim() && s.email.trim());
    if (nonEmpty.length === 0) return [];

    const emails = nonEmpty.map((s) => s.email.trim().toLowerCase());
    const userRows = await db
      .select({ email: logins.email, userId: users.id })
      .from(logins)
      .innerJoin(users, eq(users.loginId, logins.id))
      .where(inArray(logins.email, emails));
    const emailToUserId = new Map(userRows.map((r) => [r.email.toLowerCase(), r.userId]));

    return this.createBulk(
      nonEmpty.map((s, i) => ({
        ticketId,
        name: s.name.trim(),
        email: s.email.trim(),
        participantOrder: i + 1,
        userId: emailToUserId.get(s.email.trim().toLowerCase()) ?? null,
      })),
    );
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

  /**
   * Find all tickets where this email address is listed as participant order=1.
   * Used to show "assigned to me" tickets in a user's profile.
   */
  async getAssignedTickets(email: string): Promise<
    Array<
      typeof tickets.$inferSelect & {
        event: typeof events.$inferSelect;
        product: typeof products.$inferSelect;
        participants: TicketParticipant[];
      }
    >
  > {
    const rows = await db.query.ticketParticipants.findMany({
      where: { email, participantOrder: 1 },
      with: {
        ticket: {
          with: {
            event: true,
            product: true,
            participants: { orderBy: { participantOrder: "asc" } },
          },
        },
      },
    });
    return rows.map((r) => r.ticket).filter(Boolean) as any;
  },
};

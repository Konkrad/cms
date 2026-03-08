import { db } from "~/db/connection";
import {
  participationStatus,
  insertParticipationStatusSchema,
  type ParticipationStatus,
  type InsertParticipationStatus,
} from "~/db/schemas/participation-status";
import { events } from "~/db/schemas/events";
import { eq, and } from "drizzle-orm";
import { logins } from "~/db/schemas/logins";

export const participationService = {
  async create(data: InsertParticipationStatus): Promise<ParticipationStatus> {
    const validated = insertParticipationStatusSchema.parse(data);
    const [result] = await db
      .insert(participationStatus)
      .values(validated as any)
      .returning();
    return result;
  },

  async upsert(
    userId: string,
    eventId: string,
    status: "yes" | "no" | "maybe",
  ): Promise<ParticipationStatus> {
    // Check if participation status already exists
    const existing = await this.getStatus(userId, eventId);

    if (existing) {
      // Update existing status
      return this.updateStatus(userId, eventId, status);
    }

    // Create new status
    return this.create({
      userId,
      eventId,
      status,
      updatedAt: new Date().toISOString(),
    });
  },

  async updateStatus(
    userId: string,
    eventId: string,
    status: "yes" | "no" | "maybe",
  ): Promise<ParticipationStatus> {
    const [result] = await db
      .update(participationStatus)
      .set({
        status,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(participationStatus.userId, userId),
          eq(participationStatus.eventId, eventId),
        ),
      )
      .returning();
    return result;
  },

  async getStatus(
    userId: string,
    eventId: string,
  ): Promise<ParticipationStatus | undefined> {
    const result = await db.query.participationStatus.findFirst({
      where: and(
        eq(participationStatus.userId, userId),
        eq(participationStatus.eventId, eventId),
      ),
    });
    return result;
  },

  async getSummary(eventId: string): Promise<{
    yes: number;
    no: number;
    maybe: number;
    total: number;
  }> {
    const results = await db.query.participationStatus.findMany({
      where: eq(participationStatus.eventId, eventId),
    });

    const summary = {
      yes: 0,
      no: 0,
      maybe: 0,
      total: results.length,
    };

    for (const result of results) {
      if (result.status === "yes") summary.yes++;
      else if (result.status === "no") summary.no++;
      else if (result.status === "maybe") summary.maybe++;
    }

    return summary;
  },

  async getByEventId(eventId: string): Promise<ParticipationStatus[]> {
    const results = await db.query.participationStatus.findMany({
      where: eq(participationStatus.eventId, eventId),
      with: {
        user: true,
      },
    });

    // Resolve and attach user email (from the logins table) where available.
    // We do this here so callers (e.g. admin pages) can display organiser / participant emails
    // without having to run additional queries.
    for (const participation of results) {
      try {
        if (participation.user?.loginId) {
          const [loginRow] = await db
            .select()
            .from(logins)
            .where(eq(logins.id, participation.user.loginId));
          if (loginRow?.email) {
            (participation.user as any).email = loginRow.email;
          }
        }
      } catch {
        // If resolving the login/email fails for any reason, don't fail the entire response.
        // We simply skip attaching the email for that user.
      }
    }

    return results as any;
  },

  async autoUpgradeToYes(
    userId: string,
    eventId: string,
  ): Promise<ParticipationStatus | null> {
    const existing = await this.getStatus(userId, eventId);

    // Only upgrade if current status is "maybe"
    if (existing && existing.status === "maybe") {
      return this.updateStatus(userId, eventId, "yes");
    }

    // If no existing status or already "yes"/"no", create/keep as "yes"
    if (!existing) {
      return this.upsert(userId, eventId, "yes");
    }

    return existing;
  },

  async delete(userId: string, eventId: string): Promise<void> {
    await db
      .delete(participationStatus)
      .where(
        and(
          eq(participationStatus.userId, userId),
          eq(participationStatus.eventId, eventId),
        ),
      );
  },

  async getByUserId(userId: string): Promise<{
    past: Array<{ id: string; title: string; startDate: string; endDate: string; city: string | null; country: string | null }>;
    upcoming: Array<{ id: string; title: string; startDate: string; endDate: string; city: string | null; country: string | null }>;
  }> {
    const rows = await db.query.participationStatus.findMany({
      where: and(
        eq(participationStatus.userId, userId),
        eq(participationStatus.status, "yes"),
      ),
      with: { event: true },
    });

    const now = new Date().toISOString();
    const past = [];
    const upcoming = [];

    for (const row of rows) {
      const e = row.event;
      const entry = {
        id: e.id,
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        city: e.city ?? null,
        country: e.country ?? null,
      };
      if (e.endDate < now) {
        past.push(entry);
      } else {
        upcoming.push(entry);
      }
    }

    past.sort((a, b) => b.startDate.localeCompare(a.startDate));
    upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));

    return { past, upcoming };
  },
};

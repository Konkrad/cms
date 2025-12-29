import { db } from "~/db/connection";
import {
  eventPhotos,
  insertEventPhotoSchema,
  type EventPhoto,
  type InsertEventPhoto,
} from "~/db/schemas/event-photos";
import { tickets } from "~/db/schemas/tickets";
import { eq, and, isNotNull } from "drizzle-orm";
import { generateSecurePhotoUrl } from "~/utils/secure-urls";

export const photosService = {
  async create(data: InsertEventPhoto): Promise<EventPhoto> {
    const validated = insertEventPhotoSchema.parse(data);
    const [photo] = await db
      .insert(eventPhotos)
      .values(validated as any)
      .returning();
    return photo;
  },

  async getById(id: string): Promise<EventPhoto | undefined> {
    const result = await db.query.eventPhotos.findFirst({
      where: eq(eventPhotos.id, id),
    });
    return result;
  },

  async getByEventId(
    eventId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<EventPhoto[]> {
    const { limit = 20, offset = 0 } = options || {};
    const results = await db.query.eventPhotos.findMany({
      where: eq(eventPhotos.eventId, eventId),
      orderBy: (photos, { desc }) => [desc(photos.uploadedAt)],
      limit,
      offset,
    });
    return results;
  },

  async countByEventId(eventId: string): Promise<number> {
    const results = await db.query.eventPhotos.findMany({
      where: eq(eventPhotos.eventId, eventId),
    });
    return results.length;
  },

  async delete(id: string): Promise<void> {
    await db.delete(eventPhotos).where(eq(eventPhotos.id, id));
  },

  async checkUserAttendance(userId: string, eventId: string): Promise<boolean> {
    const attendedTicket = await db.query.tickets.findFirst({
      where: and(
        eq(tickets.buyerId, userId),
        eq(tickets.eventId, eventId),
        isNotNull(tickets.scannedAt),
      ),
    });
    return !!attendedTicket;
  },

  async generateSecureUrl(
    photoId: string,
    userId: string,
  ): Promise<{ url: string; expiresAt: string } | null> {
    const photo = await this.getById(photoId);
    if (!photo) {
      return null;
    }

    // Check if user attended the event
    const hasAttended = await this.checkUserAttendance(userId, photo.eventId);
    if (!hasAttended) {
      return null;
    }

    // Generate secure URL valid for 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const expUnix = Math.floor(Date.parse(expiresAt) / 1000);

    const url = await generateSecurePhotoUrl(photo.filePath, userId, expUnix);

    return {
      url,
      expiresAt,
    };
  },

  async validatePhotoAccess(photoId: string, userId: string): Promise<boolean> {
    const photo = await this.getById(photoId);
    if (!photo) {
      return false;
    }

    return this.checkUserAttendance(userId, photo.eventId);
  },
};

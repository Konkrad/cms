import { and, eq } from "drizzle-orm";
import { participationStatus } from "~/db/schemas/participation-status";
import { events } from "~/db/schemas/events";
import { db } from "~/db/connection";
import {
  userTags,
  insertUserTagSchema,
  type UserTag,
} from "~/db/schemas/user-tags";
import { TAG_RULES } from "~/config/tag-rules";
import crypto from "crypto";

export const userTagsService = {
  async getByUser(userId: string): Promise<UserTag[]> {
    return db.query.userTags.findMany({
      where: { userId },
      orderBy: { grantedAt: "desc" },
    });
  },

  async getAll(): Promise<UserTag[]> {
    return db.query.userTags.findMany({ orderBy: { grantedAt: "desc" } });
  },

  async grant(
    userId: string,
    slug: string,
    label: string,
    category: "board" | "qualification" | "participation" | "custom",
    sourceType: "manual" | "qualification" | "election" | "rule",
    sourceId?: string,
    grantedBy?: string,
  ): Promise<UserTag> {
    const [existing] = await db
      .select()
      .from(userTags)
      .where(and(eq(userTags.userId, userId), eq(userTags.slug, slug)))
      .limit(1);
    if (existing) return existing;

    const validated = insertUserTagSchema.parse({
      id: crypto.randomUUID(),
      userId,
      slug,
      label,
      category,
      sourceType,
      sourceId: sourceId ?? null,
      grantedBy: grantedBy ?? null,
    });
    const [row] = await db
      .insert(userTags)
      .values(validated as any)
      .returning();
    return row;
  },

  async adminGrant(
    userId: string,
    slug: string,
    label: string,
    category: "board" | "qualification" | "participation" | "custom",
    adminUserId: string,
  ): Promise<UserTag> {
    return this.grant(userId, slug, label, category, "manual", undefined, adminUserId);
  },

  async revoke(userId: string, slug: string): Promise<void> {
    await db
      .delete(userTags)
      .where(and(eq(userTags.userId, userId), eq(userTags.slug, slug)));
  },

  async evaluateRulesForUser(userId: string): Promise<void> {
    const participations = await db
      .select({ p: participationStatus, event: events })
      .from(participationStatus)
      .leftJoin(events, eq(participationStatus.eventId, events.id))
      .where(
        and(
          eq(participationStatus.userId, userId),
          eq(participationStatus.status, "yes"),
        ),
      );

    const now = new Date().toISOString();
    const pastYes = participations.filter(
      (row) => row.event && row.event.endDate < now,
    );

    for (const rule of TAG_RULES) {
      let count = 0;

      switch (rule.conditionType) {
        case "participation_total":
          count = pastYes.length;
          break;
        case "participation_locationType":
          count = pastYes.filter(
            (row) => row.event?.locationType === rule.conditionFilter,
          ).length;
          break;
        case "participation_group":
          count = pastYes.filter(
            (row) => row.event?.groupId === rule.conditionFilter,
          ).length;
          break;
        case "participation_visibility":
          count = pastYes.filter(
            (row) => row.event?.visibility === rule.conditionFilter,
          ).length;
          break;
      }

      if (count >= rule.conditionCount) {
        await this.grant(userId, rule.slug, rule.label, rule.category, "rule");
      }
    }
  },
};

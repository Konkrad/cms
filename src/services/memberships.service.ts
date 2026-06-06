import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import {
  userMemberships,
  insertUserMembershipSchema,
  type UserMembership,
} from "~/db/schemas/user-memberships";
import crypto from "crypto";

const TIER_RANK: Record<string, number> = { associated: 1, full: 2 };

export const membershipsService = {
  async getByUser(userId: string): Promise<UserMembership | undefined> {
    return db.query.userMemberships.findFirst({ where: { userId } });
  },

  async getAll(): Promise<UserMembership[]> {
    return db.query.userMemberships.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  async setTier(
    userId: string,
    tier: "associated" | "full",
    grantedBy?: string,
    notes?: string,
  ): Promise<UserMembership> {
    const existing = await this.getByUser(userId);
    if (existing) {
      const [row] = await db
        .update(userMemberships)
        .set({
          tier,
          grantedBy: grantedBy ?? null,
          grantedAt: new Date().toISOString(),
          notes: notes ?? null,
          updatedAt: new Date().toISOString(),
        } as any)
        .where(eq(userMemberships.userId, userId))
        .returning();
      return row;
    }
    const validated = insertUserMembershipSchema.parse({
      id: crypto.randomUUID(),
      userId,
      tier,
      grantedBy: grantedBy ?? null,
      notes: notes ?? null,
    });
    const [row] = await db
      .insert(userMemberships)
      .values(validated as any)
      .returning();
    return row;
  },

  async upgradeIfHigher(
    userId: string,
    tier: "associated" | "full",
  ): Promise<void> {
    const existing = await this.getByUser(userId);
    const currentRank = existing ? (TIER_RANK[existing.tier] ?? 0) : 0;
    const newRank = TIER_RANK[tier] ?? 0;
    if (newRank > currentRank) {
      await this.setTier(userId, tier);
    }
  },

  async removeMembership(userId: string): Promise<void> {
    await db
      .delete(userMemberships)
      .where(eq(userMemberships.userId, userId));
  },

  async hasTier(
    userId: string,
    minTier: "associated" | "full",
  ): Promise<boolean> {
    const membership = await this.getByUser(userId);
    if (!membership) return false;
    const currentRank = TIER_RANK[membership.tier] ?? 0;
    const requiredRank = TIER_RANK[minTier] ?? 0;
    return currentRank >= requiredRank;
  },
};

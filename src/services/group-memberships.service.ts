import { db } from "~/db/connection";
import {
  groupMemberships,
  groups,
  insertGroupMembershipSchema,
  type GroupMembership,
  type Group,
} from "~/db/schema";
import { eq, and } from "drizzle-orm";

export const groupMembershipsService = {
  async isMember(userId: string, groupId: string): Promise<boolean> {
    const results = await db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.userId, userId),
          eq(groupMemberships.groupId, groupId)
        )
      )
      .limit(1);
    return results.length > 0;
  },

  async join(userId: string, groupId: string): Promise<GroupMembership> {
    const validated = await insertGroupMembershipSchema.parseAsync({
      userId,
      groupId,
    });
    const [membership] = await db
      .insert(groupMemberships)
      .values(validated)
      .returning();
    return membership;
  },

  async getUserGroups(userId: string): Promise<Group[]> {
    const results = await db
      .select({
        id: groups.id,
        name: groups.name,
        slug: groups.slug,
        latitude: groups.latitude,
        longitude: groups.longitude,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
      })
      .from(groupMemberships)
      .innerJoin(groups, eq(groupMemberships.groupId, groups.id))
      .where(eq(groupMemberships.userId, userId));
    return results;
  },

  async getGroupMembers(groupId: string) {
    const results = await db
      .select()
      .from(groupMemberships)
      .where(eq(groupMemberships.groupId, groupId));
    return results;
  },

  async getMembership(
    userId: string,
    groupId: string
  ): Promise<GroupMembership | null> {
    const results = await db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.userId, userId),
          eq(groupMemberships.groupId, groupId)
        )
      )
      .limit(1);
    return results[0] || null;
  },
};

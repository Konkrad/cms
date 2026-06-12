import { db } from "~/db/connection";
import {
  groupRepresentatives,
  insertGroupRepresentativeSchema,
  type GroupRepresentative,
} from "~/db/schema";
import { users } from "~/db/schemas/users";
import { eq, and } from "drizzle-orm";

export type RepresentativeWithUser = GroupRepresentative & {
  user: {
    id: string;
    name: string;
    familyName: string;
    profilePicture: string | null;
  };
};

export const groupRepresentativesService = {
  async isRepresentative(userId: string, groupId: string): Promise<boolean> {
    const results = await db
      .select()
      .from(groupRepresentatives)
      .where(
        and(
          eq(groupRepresentatives.userId, userId),
          eq(groupRepresentatives.groupId, groupId),
        ),
      )
      .limit(1);
    return results.length > 0;
  },

  async isRepresentativeOfAny(userId: string): Promise<boolean> {
    const results = await db
      .select({ id: groupRepresentatives.id })
      .from(groupRepresentatives)
      .where(eq(groupRepresentatives.userId, userId))
      .limit(1);
    return results.length > 0;
  },

  async promote(
    userId: string,
    groupId: string,
    promotedBy: string,
  ): Promise<GroupRepresentative> {
    const validated = await insertGroupRepresentativeSchema.parseAsync({
      userId,
      groupId,
      promotedBy,
    });
    const [representative] = await db
      .insert(groupRepresentatives)
      .values(validated as any)
      .returning();
    return representative;
  },

  async getRepresentatives(groupId: string): Promise<GroupRepresentative[]> {
    return await db
      .select()
      .from(groupRepresentatives)
      .where(eq(groupRepresentatives.groupId, groupId));
  },

  async getFirstRepresentativeWithUser(
    groupId: string,
  ): Promise<RepresentativeWithUser | null> {
    const results = await db
      .select({
        id: groupRepresentatives.id,
        userId: groupRepresentatives.userId,
        groupId: groupRepresentatives.groupId,
        promotedAt: groupRepresentatives.promotedAt,
        promotedBy: groupRepresentatives.promotedBy,
        user: {
          id: users.id,
          name: users.name,
          familyName: users.familyName,
          profilePicture: users.profilePicture,
        },
      })
      .from(groupRepresentatives)
      .innerJoin(users, eq(groupRepresentatives.userId, users.id))
      .where(eq(groupRepresentatives.groupId, groupId))
      .limit(1);
    return (results[0] as RepresentativeWithUser) ?? null;
  },
};

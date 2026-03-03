import { db } from "~/db/connection";
import {
  groupRepresentatives,
  insertGroupRepresentativeSchema,
  type GroupRepresentative,
} from "~/db/schema";
import { eq, and } from "drizzle-orm";

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
};

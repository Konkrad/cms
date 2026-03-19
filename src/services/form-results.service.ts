import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "~/db/connection";
import { formResults, insertFormResultSchema } from "~/db/schema";
import type { FormResult, InsertFormResult } from "~/db/schema";

export const formResultsService = {
  async getCountsByFormIds(formIds: string[]): Promise<Record<string, number>> {
    if (formIds.length === 0) {
      return {};
    }

    const rows = await db
      .select({
        formId: formResults.formId,
        total: count(),
      })
      .from(formResults)
      .where(inArray(formResults.formId, formIds))
      .groupBy(formResults.formId);

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.formId] = row.total;
    }

    return counts;
  },

  async getByFormAndUser(formId: string, userId: string): Promise<FormResult | undefined> {
    return db.query.formResults.findFirst({
      where: and(eq(formResults.formId, formId), eq(formResults.userId, userId)),
    });
  },

  async getByUser(userId: string): Promise<Array<FormResult & { formTitle: string; formSlug: string }>> {
    const rows = await db.query.formResults.findMany({
        where: eq(formResults.userId, userId),
        with: {
          form: true,
        },
        orderBy: [desc(formResults.submittedAt)],
      });

      return rows.map((row) => ({
        ...row,
        formTitle: row.form.title,
        formSlug: row.form.slug,
      }));
  },

  async getByForm(formId: string): Promise<FormResult[]> {
    return db.query.formResults.findMany({
      where: eq(formResults.formId, formId),
      orderBy: [desc(formResults.submittedAt)],
    });
  },

  async getByFormWithUser(
    formId: string,
  ): Promise<Array<FormResult & { userLoginId: string | null; userName: string | null }>> {
    const rows = await db.query.formResults.findMany({
      where: eq(formResults.formId, formId),
      with: {
        user: true,
      },
      orderBy: [desc(formResults.submittedAt)],
    });

    return rows.map((row) => ({
      ...row,
      userLoginId: row.user?.loginId || null,
      userName: row.user?.name || null,
    }));
  },

  async create(data: InsertFormResult): Promise<FormResult> {
    const parsed = insertFormResultSchema.parse(data);
    const [created] = await db.insert(formResults).values(parsed as any).returning();
    return created;
  },
};

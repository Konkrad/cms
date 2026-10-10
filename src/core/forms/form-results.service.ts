import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "~/core/db/connection";
import type { FormResult, InsertFormResult } from "~/core/db/schema";
import { formResults, insertFormResultSchema } from "~/core/db/schema";

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

	async getByFormAndUser(
		formId: string,
		userId: string,
	): Promise<FormResult | undefined> {
		return db.query.formResults.findFirst({
			where: { formId, userId },
		});
	},

	async getByUser(
		userId: string,
	): Promise<Array<FormResult & { formTitle: string; formSlug: string }>> {
		const rows = (await db.query.formResults.findMany({
			where: { userId },
			with: {
				form: true,
			},
			orderBy: { submittedAt: "desc" },
		})) as any[];

		return rows.map((row) => ({
			...row,
			formTitle: row.form.title,
			formSlug: row.form.slug,
		}));
	},

	async getByForm(formId: string): Promise<FormResult[]> {
		return db.query.formResults.findMany({
			where: { formId },
			orderBy: { submittedAt: "desc" },
		});
	},

	async create(data: InsertFormResult): Promise<FormResult> {
		const parsed = insertFormResultSchema.parse(data);
		const [created] = await db
			.insert(formResults)
			.values(parsed as any)
			.returning();
		return created;
	},

	async upsert(data: InsertFormResult): Promise<FormResult> {
		const parsed = insertFormResultSchema.parse(data);
		const [result] = await db
			.insert(formResults)
			.values(parsed as any)
			.onConflictDoUpdate({
				target: [formResults.formId, formResults.userId],
				set: {
					resultJson: parsed.resultJson,
					submittedAt: new Date().toISOString(),
				},
			})
			.returning();
		return result;
	},
};

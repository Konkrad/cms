import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "~/core/db/connection";
import {
	type FormAnswers,
	type FormResult,
	formResults,
} from "~/core/forms/schema/form-results";
import { type Form, forms } from "~/core/forms/schema/forms";
import { publicUserSelect } from "~/core/users/public-user";
import { users } from "~/core/users/schema";

export type { FormAnswers, FormResult };

export interface NewResult {
	formId: string;
	userId: string | null;
	/** The item the answers are about (`events:event:<id>`), or null. */
	subjectRef?: string | null;
	/** Already validated against the form (`validateAnswers`). */
	answers: FormAnswers;
	altchaPayload?: string | null;
}

export const formResultsService = {
	async getCountsByFormIds(formIds: string[]): Promise<Record<string, number>> {
		if (formIds.length === 0) return {};
		const rows = await db
			.select({ formId: formResults.formId, total: count() })
			.from(formResults)
			.where(inArray(formResults.formId, formIds))
			.groupBy(formResults.formId);
		return Object.fromEntries(rows.map((r) => [r.formId, r.total]));
	},

	/** The user's own answers to a form that is not about an item (surveys, onboarding). */
	async getByFormAndUser(
		formId: string,
		userId: string,
	): Promise<FormResult | undefined> {
		const [row] = await db
			.select()
			.from(formResults)
			.where(
				and(
					eq(formResults.formId, formId),
					eq(formResults.userId, userId),
					isNull(formResults.subjectRef),
				),
			)
			.orderBy(desc(formResults.createdAt))
			.limit(1);
		return row;
	},

	/** The user's own survey answers (not those attached to items), with their forms. */
	async getByUser(userId: string): Promise<
		Array<
			FormResult & {
				formTitle: string;
				formSlug: string;
				formPurpose: string | null;
			}
		>
	> {
		const rows = await db
			.select({
				result: formResults,
				formTitle: forms.title,
				formSlug: forms.slug,
				formPurpose: forms.purpose,
			})
			.from(formResults)
			.innerJoin(forms, eq(forms.id, formResults.formId))
			.where(
				and(eq(formResults.userId, userId), isNull(formResults.subjectRef)),
			)
			.orderBy(desc(formResults.createdAt));
		return rows.map(({ result, ...form }) => ({ ...result, ...form }));
	},

	async getByForm(formId: string): Promise<FormResult[]> {
		return db
			.select()
			.from(formResults)
			.where(eq(formResults.formId, formId))
			.orderBy(desc(formResults.createdAt));
	},

	/**
	 * Every result attached to an item, newest first, with its form and the author's public
	 * name. For the item's admin page only (`forms.resultsFor` checks the viewer).
	 */
	async getBySubject(subjectRef: string): Promise<
		Array<{
			result: FormResult;
			form: Pick<Form, "id" | "title" | "purpose" | "schema">;
			author: { id: string; name: string; familyName: string } | null;
		}>
	> {
		const rows = await db
			.select({
				result: formResults,
				form: {
					id: forms.id,
					title: forms.title,
					purpose: forms.purpose,
					schema: forms.schema,
				},
				author: publicUserSelect,
			})
			.from(formResults)
			.innerJoin(forms, eq(forms.id, formResults.formId))
			.leftJoin(users, eq(users.id, formResults.userId))
			.where(eq(formResults.subjectRef, subjectRef))
			.orderBy(desc(formResults.createdAt));
		return rows.map((r) => ({
			result: r.result,
			form: r.form,
			author: r.author?.id
				? {
						id: r.author.id,
						name: r.author.name,
						familyName: r.author.familyName,
					}
				: null,
		}));
	},

	async create(data: NewResult): Promise<FormResult> {
		const [created] = await db
			.insert(formResults)
			.values({
				id: crypto.randomUUID(),
				formId: data.formId,
				userId: data.userId,
				subjectRef: data.subjectRef ?? null,
				answers: data.answers,
				altchaPayload: data.altchaPayload ?? null,
				createdAt: new Date().toISOString(),
			})
			.returning();
		return created;
	},

	/**
	 * The user's answers to a form they may change (`allowResubmission`, the onboarding survey):
	 * replaces their previous answers, or creates them.
	 */
	async saveOwn(data: NewResult & { userId: string }): Promise<FormResult> {
		const existing = await this.getByFormAndUser(data.formId, data.userId);
		if (!existing) return this.create(data);
		const [updated] = await db
			.update(formResults)
			.set({
				answers: data.answers,
				altchaPayload: data.altchaPayload ?? null,
				createdAt: new Date().toISOString(),
			})
			.where(eq(formResults.id, existing.id))
			.returning();
		return updated;
	},
};

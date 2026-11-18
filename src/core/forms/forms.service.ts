import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "~/core/db/connection";
import { formQuestions, validateAnswers } from "~/core/forms/answers";
import { formValidationService } from "~/core/forms/form-validation.service";
import { buildFormPath } from "~/core/forms/forms";
import { formResults } from "~/core/forms/schema/form-results";
import {
	type Form,
	type FormSchema,
	formAssignments,
	forms,
} from "~/core/forms/schema/forms";
import { t } from "~/core/i18n";
import { scopesService } from "~/core/scopes/scopes.service";
import { slugify, uniqueSlug } from "~/core/shared/slug";

export type { Form, FormSchema };

/** The form has results, so its questions can no longer change (spec 4.10). */
export class FormLockedError extends Error {
	constructor() {
		super(t("core.forms.locked"));
		this.name = "FormLockedError";
	}
}

/** Bad input from an admin (unknown purpose, a form outside the scope, …). */
export class FormInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FormInputError";
	}
}

export interface FormInput {
	scopeId: string;
	title: string;
	slug: string;
	description?: string | null;
	schema: FormSchema;
	purpose?: string | null;
	visibility?: "private" | "public";
	allowResubmission?: boolean;
	createdBy: string | null;
}

/** Fields an admin may change; `schema` only while the form has no results. */
export type FormUpdate = Partial<
	Pick<
		FormInput,
		| "title"
		| "slug"
		| "description"
		| "schema"
		| "purpose"
		| "visibility"
		| "allowResubmission"
	>
>;

const sameJson = (a: unknown, b: unknown) =>
	JSON.stringify(a) === JSON.stringify(b);

/** Ids of the scope and its ancestors, nearest first. */
async function scopeChain(scopeId: string): Promise<string[]> {
	const ancestors = await scopesService.getAncestors(scopeId);
	return [scopeId, ...ancestors.map((a) => a.id).reverse()];
}

export const formsService = {
	buildFormPath(form: Pick<Form, "id" | "slug">): string {
		return buildFormPath(form);
	},

	async getById(id: string): Promise<Form | undefined> {
		return db.query.forms.findFirst({ where: { id } });
	},

	async getByRouteSlug(routeSlug: string): Promise<Form | undefined> {
		const id = routeSlug.substring(0, 36);
		if (!id || id.length !== 36) return undefined;
		return this.getById(id);
	},

	/** Forms owned by one scope, newest first. */
	async listOwn(scopeId: string): Promise<Form[]> {
		return db.query.forms.findMany({
			where: { scopeId },
			orderBy: { createdAt: "desc" },
		});
	},

	/**
	 * Forms a scope may use: its own and its ancestors' (optionally of one purpose), nearest
	 * scope first. These are the candidates for the scope's active form of a purpose.
	 */
	async listAvailable(scopeId: string, purpose?: string): Promise<Form[]> {
		const chain = await scopeChain(scopeId);
		const rows = await db
			.select()
			.from(forms)
			.where(
				and(
					inArray(forms.scopeId, chain),
					purpose ? eq(forms.purpose, purpose) : undefined,
				),
			)
			.orderBy(desc(forms.createdAt));
		return rows.sort(
			(a, b) => chain.indexOf(a.scopeId) - chain.indexOf(b.scopeId),
		);
	},

	/** Whether the form is available in the scope (owned by it or by an ancestor). */
	async isAvailableIn(form: Pick<Form, "scopeId">, scopeId: string) {
		return (await scopeChain(scopeId)).includes(form.scopeId);
	},

	async countResults(formId: string): Promise<number> {
		const [row] = await db
			.select({ total: count() })
			.from(formResults)
			.where(eq(formResults.formId, formId));
		return Number(row?.total ?? 0);
	},

	/** A form with at least one result is locked: its questions can no longer change. */
	async isLocked(formId: string): Promise<boolean> {
		return (await this.countResults(formId)) > 0;
	},

	async create(input: FormInput): Promise<Form> {
		const schema = formValidationService.validateSurveyJson(input.schema);
		const now = new Date().toISOString();
		const [created] = await db
			.insert(forms)
			.values({
				id: crypto.randomUUID(),
				scopeId: input.scopeId,
				title: input.title,
				slug: input.slug,
				description: input.description ?? null,
				schema,
				purpose: input.purpose || null,
				visibility: input.visibility ?? "private",
				allowResubmission: input.allowResubmission ?? false,
				createdBy: input.createdBy,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return created;
	},

	/**
	 * Updates the whitelisted fields. A changed schema on a form with results throws
	 * `FormLockedError` (an unchanged one is fine, so the edit page can resend it).
	 */
	async update(id: string, changes: FormUpdate): Promise<Form | undefined> {
		const current = await this.getById(id);
		if (!current) return undefined;
		const set: Partial<Form> = { updatedAt: new Date().toISOString() };
		if (changes.schema !== undefined) {
			const schema = formValidationService.validateSurveyJson(changes.schema);
			if (!sameJson(schema, current.schema)) {
				if (await this.isLocked(id)) throw new FormLockedError();
				set.schema = schema;
			}
		}
		if (changes.title !== undefined) set.title = changes.title;
		if (changes.slug !== undefined) set.slug = changes.slug;
		if (changes.description !== undefined)
			set.description = changes.description;
		if (changes.purpose !== undefined) set.purpose = changes.purpose || null;
		if (changes.visibility !== undefined) set.visibility = changes.visibility;
		if (changes.allowResubmission !== undefined)
			set.allowResubmission = changes.allowResubmission;
		const [updated] = await db
			.update(forms)
			.set(set)
			.where(eq(forms.id, id))
			.returning();
		return updated;
	},

	/**
	 * An editable copy of a form (same questions, purpose and settings) in `scopeId` (default:
	 * the original's scope): how admins change the questions of a locked form.
	 */
	async duplicate(
		id: string,
		createdBy: string | null,
		scopeId?: string,
	): Promise<Form> {
		const original = await this.getById(id);
		if (!original) throw new FormInputError(t("core.forms.notFound"));
		const targetScope = scopeId ?? original.scopeId;
		const slug = await uniqueSlug(
			slugify(`${original.slug}-copy`) || "form-copy",
			async (s) =>
				Boolean(
					await db.query.forms.findFirst({
						where: { scopeId: targetScope, slug: s },
						columns: { id: true },
					}),
				),
		);
		return this.create({
			scopeId: targetScope,
			title: `${original.title} (copy)`,
			slug,
			description: original.description,
			schema: original.schema,
			purpose: original.purpose,
			visibility: original.visibility,
			allowResubmission: original.allowResubmission,
			createdBy,
		});
	},

	/** Answers validated against the form's schema (throws `FormAnswerError`). */
	validateAnswers(form: Pick<Form, "schema">, raw: unknown) {
		return validateAnswers(form.schema, raw);
	},

	questions(form: Pick<Form, "schema">) {
		return formQuestions(form.schema);
	},
};

export const formAssignmentsService = {
	/**
	 * The active form of a purpose for a scope: the assignment of the scope itself, else of the
	 * nearest ancestor that has one. Undefined when no scope up the tree assigned one.
	 */
	async activeFor(purpose: string, scopeId: string): Promise<Form | undefined> {
		const chain = await scopeChain(scopeId);
		const rows = await db
			.select({ scopeId: formAssignments.scopeId, form: forms })
			.from(formAssignments)
			.innerJoin(forms, eq(forms.id, formAssignments.formId))
			.where(
				and(
					eq(formAssignments.purpose, purpose),
					inArray(formAssignments.scopeId, chain),
				),
			);
		rows.sort((a, b) => chain.indexOf(a.scopeId) - chain.indexOf(b.scopeId));
		return rows[0]?.form;
	},

	/** The assignments made on one scope (not inherited ones), by purpose. */
	async listOwn(scopeId: string): Promise<Record<string, string>> {
		const rows = await db
			.select()
			.from(formAssignments)
			.where(eq(formAssignments.scopeId, scopeId));
		return Object.fromEntries(rows.map((r) => [r.purpose, r.formId]));
	},

	/**
	 * Makes `formId` the active form of `purpose` on the scope (and below, until a scope further
	 * down picks another), or clears the scope's own choice with null (it inherits again). The
	 * form must have that purpose and belong to the scope or an ancestor.
	 */
	async setActive(
		purpose: string,
		scopeId: string,
		formId: string | null,
	): Promise<void> {
		if (!formId) {
			await db
				.delete(formAssignments)
				.where(
					and(
						eq(formAssignments.purpose, purpose),
						eq(formAssignments.scopeId, scopeId),
					),
				);
			return;
		}
		const form = await formsService.getById(formId);
		if (!form) throw new FormInputError(t("core.forms.notFound"));
		if (form.purpose !== purpose)
			throw new FormInputError(t("core.forms.wrongPurpose"));
		if (!(await formsService.isAvailableIn(form, scopeId)))
			throw new FormInputError(t("core.forms.wrongScope"));
		const now = new Date().toISOString();
		await db
			.insert(formAssignments)
			.values({ purpose, scopeId, formId, updatedAt: now })
			.onConflictDoUpdate({
				target: [formAssignments.purpose, formAssignments.scopeId],
				set: { formId, updatedAt: now },
			});
	},
};

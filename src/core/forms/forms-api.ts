import {
	answerRows,
	FormAnswerError,
	type FormQuestion,
	formQuestions,
} from "~/core/forms/answers";
import { formResultsService } from "~/core/forms/form-results.service";
import {
	formAssignmentsService,
	formsService,
} from "~/core/forms/forms.service";
import type { FormSchema } from "~/core/forms/schema/forms";
import { t } from "~/core/i18n";
import { locateRef } from "~/core/registry/refs";
import { ADMIN_ACCESS, canManageScope } from "~/core/scopes/access";

/**
 * The forms API for modules (`forms` from `~/core`, spec 4.10). Server-only. A module declares
 * the purposes it uses in its manifest (`forms: [{ purpose, label }]`); admins pick the active
 * form per purpose and scope; the module renders it with `FormRenderer` (`~/core/ui`) and
 * stores the answers against one of its items by reference.
 */

/** The viewer is not allowed to read the results attached to an item. */
export class FormAccessError extends Error {
	constructor() {
		super(t("core.forms.onlyManagersReadAnswers"));
		this.name = "FormAccessError";
	}
}

/** An active form as a module renders it. */
export interface ActiveForm {
	id: string;
	title: string;
	description: string | null;
	schema: FormSchema;
	questions: FormQuestion[];
}

/** One stored result about an item, as text rows for its admin page. */
export interface ItemFormResult {
	id: string;
	formId: string;
	formTitle: string;
	purpose: string | null;
	createdAt: string;
	authorName: string | null;
	rows: Array<{ name: string; question: string; answer: string }>;
}

export const forms = {
	/**
	 * The active form of `purpose` for the scope (the nearest scope up the tree that picked
	 * one), or null when none is set anywhere above.
	 */
	async active(
		ctx: { scopeId: string },
		purpose: string,
	): Promise<ActiveForm | null> {
		const form = await formAssignmentsService.activeFor(purpose, ctx.scopeId);
		if (!form) return null;
		return {
			id: form.id,
			title: form.title,
			description: form.description,
			schema: form.schema,
			questions: formQuestions(form.schema),
		};
	},

	/**
	 * Validates the answers against the form's schema on the server and stores them as a result
	 * by `ctx.userId`, attached to `subjectRef` (`events:event:<id>`). Throws `FormAnswerError`
	 * (with a message per question) for invalid answers or an unknown form. The form locks.
	 */
	async submit(
		ctx: { userId: string },
		formId: string,
		input: { subjectRef?: string | null; answers: unknown },
	): Promise<{ id: string; answers: Record<string, unknown> }> {
		const form = await formsService.getById(formId);
		if (!form) throw new FormAnswerError(t("core.forms.unknownForm"));
		const answers = formsService.validateAnswers(form, input.answers);
		const result = await formResultsService.create({
			formId: form.id,
			userId: ctx.userId,
			subjectRef: input.subjectRef ?? null,
			answers,
		});
		return { id: result.id, answers };
	},

	/** Whether an item has answers to a form of `purpose` (e.g. its debrief was filled in). */
	hasResult: (subjectRef: string, purpose: string): Promise<boolean> =>
		formResultsService.existsForSubject(subjectRef, purpose),

	/**
	 * The results attached to an item, newest first, as question/answer text rows. Only for
	 * managers of the item's scope (roles inherit downward, so platform admins too); throws
	 * `FormAccessError` for anyone else and for a reference that does not resolve.
	 */
	async resultsFor(
		ctx: { userId: string },
		subjectRef: string,
	): Promise<ItemFormResult[]> {
		const item = await locateRef(subjectRef);
		if (
			!item ||
			!(await canManageScope({ id: ctx.userId }, item.scopeId, ADMIN_ACCESS))
		)
			throw new FormAccessError();
		const rows = await formResultsService.getBySubject(subjectRef);
		return rows.map(({ result, form, author }) => ({
			id: result.id,
			formId: form.id,
			formTitle: form.title,
			purpose: form.purpose,
			createdAt: result.createdAt,
			authorName: author ? `${author.name} ${author.familyName}` : null,
			rows: answerRows(form.schema, result.answers),
		}));
	},
};

export { FormAnswerError };
export type { FormQuestion };

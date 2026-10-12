import { Model } from "survey-core";
import type { FormSchema } from "~/core/forms/schema/forms";

/**
 * Server-side answer validation against a form's SurveyJS schema (spec 4.10). The browser's
 * SurveyJS runtime (or a plain HTML form from `FormRenderer`) is never trusted: every answer
 * is checked here before it is stored. Free text is kept as plain text: it is stored as typed
 * and only ever rendered as text, never as HTML.
 */

export class FormAnswerError extends Error {
	constructor(
		message: string,
		/** Problem per question name. */
		readonly fieldErrors: Record<string, string> = {},
	) {
		super(message);
		this.name = "FormAnswerError";
	}
}

export interface FormChoice {
	value: string | number;
	text: string;
}

/** A question of a form, as the admin, `FormRenderer` and result views need it. */
export interface FormQuestion {
	name: string;
	title: string;
	/** SurveyJS type: text, comment, radiogroup, dropdown, checkbox, tagbox, boolean, rating, … */
	type: string;
	required: boolean;
	description: string | null;
	choices: FormChoice[];
	/** `text` questions: "number", "email", … (SurveyJS `inputType`). */
	inputType: string | null;
	rateMin: number;
	rateMax: number;
	/** Explicit rating values (overrides the min/max range when set). */
	rateValues: Array<string | number>;
	hasOther: boolean;
}

/** Questions that carry no answer (static content). */
const DISPLAY_ONLY = new Set(["html", "image", "expression"]);
const MAX_TEXT = 5_000;
const MAX_COMMENT = 20_000;
const MAX_OTHER_JSON = 20_000;

const choiceOf = (item: any): FormChoice => ({
	value: item?.value as string | number,
	text: String(item?.text ?? item?.value ?? ""),
});

function questionInfo(q: any): FormQuestion {
	const rateValues = Array.isArray(q.rateValues)
		? q.rateValues.map((v: any) => (typeof v === "object" ? v.value : v))
		: [];
	return {
		name: String(q.name),
		title: String(q.title || q.name),
		type: String(q.getType()),
		required: Boolean(q.isRequired),
		description: q.description ? String(q.description) : null,
		choices: Array.isArray(q.choices) ? q.choices.map(choiceOf) : [],
		inputType: q.inputType ? String(q.inputType) : null,
		rateMin: Number(q.rateMin ?? 1),
		rateMax: Number(q.rateMax ?? 5),
		rateValues,
		hasOther: Boolean(q.hasOther || q.showOtherItem),
	};
}

/** The answerable questions of a schema, in order (nested panels included). */
export function formQuestions(schema: FormSchema): FormQuestion[] {
	const model = new Model(schema);
	try {
		return model
			.getAllQuestions(false, false, true)
			.filter((q: any) => !DISPLAY_ONLY.has(q.getType()))
			.map(questionInfo);
	} finally {
		model.dispose();
	}
}

const isEmpty = (v: unknown) =>
	v === undefined ||
	v === null ||
	(typeof v === "string" && v.trim() === "") ||
	(Array.isArray(v) && v.length === 0);

/** Plain text as typed: control characters (except tab/newline) removed, ends trimmed. */
function plainText(value: unknown, max: number): string {
	if (typeof value !== "string" && typeof value !== "number")
		throw new Error("must be text");
	const text = [...String(value)]
		.filter((ch) => {
			const code = ch.charCodeAt(0);
			return (
				code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)
			);
		})
		.join("")
		.trim();
	if (text.length > max) throw new Error(`is longer than ${max} characters`);
	return text;
}

function pickChoice(q: FormQuestion, value: unknown): string | number {
	if (typeof value !== "string" && typeof value !== "number")
		throw new Error("is not one of the options");
	const choice = q.choices.find((c) => String(c.value) === String(value));
	if (choice) return choice.value;
	if (q.hasOther && String(value) === "other") return "other";
	throw new Error("is not one of the options");
}

function toNumber(value: unknown): number {
	const n = typeof value === "number" ? value : Number(String(value).trim());
	if (!Number.isFinite(n)) throw new Error("must be a number");
	return n;
}

function coerce(q: FormQuestion, value: unknown): unknown {
	switch (q.type) {
		case "text":
			return q.inputType === "number" || q.inputType === "range"
				? toNumber(value)
				: plainText(value, MAX_TEXT);
		case "comment":
			return plainText(value, MAX_COMMENT);
		case "radiogroup":
		case "dropdown":
			return pickChoice(q, value);
		case "checkbox":
		case "tagbox": {
			const list = Array.isArray(value) ? value : [value];
			return [...new Set(list.map((v) => pickChoice(q, v)))];
		}
		case "boolean": {
			if (typeof value === "boolean") return value;
			const s = String(value).toLowerCase();
			if (s === "true" || s === "on" || s === "yes") return true;
			if (s === "false" || s === "off" || s === "no") return false;
			throw new Error("must be yes or no");
		}
		case "rating": {
			if (q.rateValues.length) {
				const match = q.rateValues.find((v) => String(v) === String(value));
				if (match === undefined) throw new Error("is not one of the options");
				return match;
			}
			const n = toNumber(value);
			if (n < q.rateMin || n > q.rateMax)
				throw new Error(`must be between ${q.rateMin} and ${q.rateMax}`);
			return n;
		}
		default: {
			// Complex questions (matrix, panels, …): kept as JSON data, never rendered as HTML.
			const json = JSON.stringify(value);
			if (json === undefined || json.length > MAX_OTHER_JSON)
				throw new Error("is not a valid answer");
			return JSON.parse(json);
		}
	}
}

/**
 * Validates and normalizes answers against the schema: unknown question names are rejected,
 * required visible questions must be answered, choices must be options of the question, numbers
 * and yes/no answers are coerced from form posts ("4", "on"). Answers to hidden questions
 * (`visibleIf`) are dropped. Throws `FormAnswerError` with a message per question.
 */
export function validateAnswers(
	schema: FormSchema,
	raw: unknown,
): Record<string, unknown> {
	if (!raw || typeof raw !== "object" || Array.isArray(raw))
		throw new FormAnswerError("Answers must be an object");
	const input = raw as Record<string, unknown>;
	const model = new Model(schema);
	try {
		const all = model
			.getAllQuestions(false, false, true)
			.filter((q: any) => !DISPLAY_ONLY.has(q.getType()));
		const byName = new Map(all.map((q: any) => [String(q.name), q]));
		const errors: Record<string, string> = {};

		for (const key of Object.keys(input)) {
			const base = key.endsWith("-Comment") ? key.slice(0, -8) : null;
			if (byName.has(key)) continue;
			if (base && byName.has(base) && questionInfo(byName.get(base)).hasOther)
				continue;
			errors[key] = "Unknown question";
		}

		// First pass: coerce what was given, so visibleIf conditions see typed values.
		const coerced: Record<string, unknown> = {};
		for (const q of all) {
			const info = questionInfo(q);
			const value = input[info.name];
			if (isEmpty(value)) continue;
			try {
				coerced[info.name] = coerce(info, value);
			} catch (error) {
				errors[info.name] = `${info.title} ${(error as Error).message}`;
			}
		}
		model.data = coerced;

		const answers: Record<string, unknown> = {};
		for (const q of all) {
			const info = questionInfo(q);
			if (!q.isVisible) continue;
			if (!(info.name in coerced)) {
				if (info.required && !errors[info.name])
					errors[info.name] = `${info.title} is required`;
				continue;
			}
			answers[info.name] = coerced[info.name];
			const other = input[`${info.name}-Comment`];
			if (info.hasOther && !isEmpty(other)) {
				try {
					answers[`${info.name}-Comment`] = plainText(other, MAX_TEXT);
				} catch (error) {
					errors[info.name] = `${info.title} ${(error as Error).message}`;
				}
			}
		}

		const messages = Object.values(errors);
		if (messages.length) throw new FormAnswerError(messages[0], errors);
		return answers;
	} finally {
		model.dispose();
	}
}

/** An answer as display text: choice labels instead of values, lists joined. */
export function formatAnswer(
	question: FormQuestion | undefined,
	value: unknown,
): string {
	if (value === null || value === undefined) return "";
	if (Array.isArray(value))
		return value.map((v) => formatAnswer(question, v)).join(", ");
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "string" || typeof value === "number") {
		const choice = question?.choices.find(
			(c) => String(c.value) === String(value),
		);
		return choice ? choice.text : String(value);
	}
	return JSON.stringify(value);
}

/** Answers as `{ question, answer }` text rows in schema order (unknown keys last). */
export function answerRows(
	schema: FormSchema,
	answers: Record<string, unknown>,
): Array<{ name: string; question: string; answer: string }> {
	const questions = formQuestions(schema);
	const known = new Set(questions.map((q) => q.name));
	return [
		...questions
			.filter((q) => q.name in answers)
			.map((q) => ({
				name: q.name,
				question: q.title,
				answer: formatAnswer(q, answers[q.name]),
			})),
		...Object.keys(answers)
			.filter((k) => !known.has(k))
			.map((k) => ({
				name: k,
				question: k,
				answer: formatAnswer(undefined, answers[k]),
			})),
	];
}

import { component$, type JSXOutput } from "@qwik.dev/core";
import type { FormQuestion } from "~/core/forms/answers";
import { t } from "~/core/i18n";

export type { FormQuestion };

interface FormRendererProps {
	/** The form's questions, from `forms.active(...)` (computed on the server). */
	questions: FormQuestion[];
	/** Answers to show again (after a failed submit, or the stored ones). */
	values?: Record<string, unknown> | null;
	/** Problems per question name (`FormAnswerError.fieldErrors`). */
	errors?: Record<string, string> | null;
	/** Field name prefix; the action receives `{ [prefix]: { <question>: value } }`. */
	prefix?: string;
}

const inputClass =
	"w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-300";

const asList = (v: unknown): string[] =>
	Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)];

/**
 * Renders a form's questions as plain inputs inside the caller's `<Form>` (spec 4.10). It is
 * not a security boundary: the action validates the posted answers with `forms.submit`, which
 * checks them against the form's schema on the server. Free text is shown as text, never HTML.
 */
export const FormRenderer = component$<FormRendererProps>(
	({ questions, values, errors, prefix = "answers" }) => {
		return (
			<div class="space-y-5" data-testid="form-renderer">
				{questions.map((q) => {
					const id = `${prefix}-${q.name}`;
					const name = `${prefix}.${q.name}`;
					const value = values?.[q.name];
					const error = errors?.[q.name];
					const label = (
						<span class="text-sm font-medium text-gray-800">
							{q.title}
							{q.required && <span class="text-red-600 ml-1">*</span>}
						</span>
					);
					let field: JSXOutput;
					switch (q.type) {
						case "comment":
							field = (
								<textarea
									id={id}
									name={name}
									rows={4}
									class={inputClass}
									required={q.required}
									value={value == null ? "" : String(value)}
								/>
							);
							break;
						case "radiogroup":
						case "rating": {
							const options =
								q.type === "rating"
									? (q.rateValues.length
											? q.rateValues
											: Array.from(
													{ length: q.rateMax - q.rateMin + 1 },
													(_, i) => q.rateMin + i,
												)
										).map((v) => ({ value: v, text: String(v) }))
									: q.choices;
							field = (
								<div class="flex flex-wrap gap-4" role="radiogroup">
									{options.map((c) => (
										<label
											key={String(c.value)}
											class="flex items-center gap-2"
										>
											<input
												type="radio"
												name={name}
												value={String(c.value)}
												checked={String(value) === String(c.value)}
												required={q.required}
											/>
											{c.text}
										</label>
									))}
								</div>
							);
							break;
						}
						case "checkbox":
						case "tagbox":
							field = (
								<div class="flex flex-wrap gap-4">
									{q.choices.map((c) => (
										<label
											key={String(c.value)}
											class="flex items-center gap-2"
										>
											<input
												type="checkbox"
												name={`${name}[]`}
												value={String(c.value)}
												checked={asList(value).includes(String(c.value))}
											/>
											{c.text}
										</label>
									))}
								</div>
							);
							break;
						case "dropdown":
							field = (
								<select
									id={id}
									name={name}
									class={inputClass}
									required={q.required}
								>
									<option value="">
										{t("core.forms.formRenderer.choose")}
									</option>
									{q.choices.map((c) => (
										<option
											key={String(c.value)}
											value={String(c.value)}
											selected={String(value) === String(c.value)}
										>
											{c.text}
										</option>
									))}
								</select>
							);
							break;
						case "boolean":
							field = (
								<div class="flex gap-4" role="radiogroup">
									{[
										["true", t("core.common.yes")],
										["false", t("core.common.no")],
									].map(([v, text]) => (
										<label key={v} class="flex items-center gap-2">
											<input
												type="radio"
												name={name}
												value={v}
												checked={value !== undefined && String(value) === v}
												required={q.required}
											/>
											{text}
										</label>
									))}
								</div>
							);
							break;
						default:
							field = (
								<input
									id={id}
									name={name}
									type={q.inputType === "number" ? "number" : "text"}
									class={inputClass}
									required={q.required}
									value={value == null ? "" : String(value)}
								/>
							);
					}
					const grouped = [
						"radiogroup",
						"rating",
						"checkbox",
						"tagbox",
						"boolean",
					].includes(q.type);
					return (
						<div
							key={q.name}
							class="flex flex-col gap-1"
							data-question={q.name}
						>
							{grouped ? (
								<fieldset class="flex flex-col gap-2">
									<legend>{label}</legend>
									{field}
								</fieldset>
							) : (
								<>
									<label for={id}>{label}</label>
									{field}
								</>
							)}
							{q.description && (
								<p class="text-xs text-gray-500">{q.description}</p>
							)}
							{error && <p class="text-sm text-red-700">{error}</p>}
						</div>
					);
				})}
			</div>
		);
	},
);

import { component$ } from "@qwik.dev/core";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";
import type { RequirementField } from "~/contracts/requirements";

export type GenericFieldsProps = {
	fields: RequirementField[];
	/** The viewer's own previous answers (prefill after a version bump). */
	values: Record<string, unknown>;
	errors: Record<string, string>;
};

const text = (v: unknown) => (v == null ? "" : String(v));

/** Renders a requirement's declared `fields` (requirements without a custom view). */
export const GenericFields = component$<GenericFieldsProps>(
	({ fields, values, errors }) => {
		return (
			<div class="space-y-4">
				{fields.map((field) => {
					const error = errors[field.name];
					const value = text(values[field.name]);
					switch (field.type) {
						case "radio":
							return (
								<fieldset key={field.name} class="space-y-2">
									<legend class="text-sm font-medium text-text mb-1">
										{field.label}
									</legend>
									{field.options.map((option) => (
										<label
											key={option.value}
											class="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-bg-muted"
										>
											<input
												type="radio"
												class="mt-1"
												name={field.name}
												value={option.value}
												checked={value === option.value}
												required={field.required}
											/>
											<span>
												<span class="block font-medium">{option.label}</span>
												{option.description && (
													<span class="block text-sm text-text-secondary">
														{option.description}
													</span>
												)}
											</span>
										</label>
									))}
									{error && <p class="text-sm text-error">{error}</p>}
								</fieldset>
							);
						case "select":
							return (
								<Select
									key={field.name}
									label={field.label}
									name={field.name}
									value={value}
									error={error}
									required={field.required}
								>
									{field.options.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</Select>
							);
						case "textarea":
							return (
								<TextArea
									key={field.name}
									label={field.label}
									name={field.name}
									value={value}
									error={error}
									maxLength={field.maxLength}
									required={field.required}
								/>
							);
						case "checkbox":
							return (
								<label key={field.name} class="flex items-center gap-2">
									<input
										type="checkbox"
										name={field.name}
										checked={values[field.name] === true}
										required={field.required}
									/>
									<span>{field.label}</span>
									{error && <span class="text-sm text-error">{error}</span>}
								</label>
							);
						default:
							return (
								<Input
									key={field.name}
									label={field.label}
									name={field.name}
									type="text"
									value={value}
									error={error}
									maxLength={field.maxLength}
									required={field.required}
								/>
							);
					}
				})}
			</div>
		);
	},
);

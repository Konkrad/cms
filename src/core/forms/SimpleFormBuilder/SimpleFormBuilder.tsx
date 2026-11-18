import { component$, useSignal } from "@qwik.dev/core";
import { t } from "~/core/i18n";

type FieldType = "text" | "textarea" | "radiogroup" | "select";

type FieldDraft = {
	uid: string;
	name: string;
	title: string;
	type: FieldType;
	required: boolean;
	description: string;
	options: Array<{ uid: string; value: string; text: string }>;
};

type SimpleFormBuilderProps = {
	inputName: string;
	initialValue?: string;
};

const createField = (index = 1): FieldDraft => ({
	uid: crypto.randomUUID(),
	name: `field_${index}`,
	title: "",
	type: "text",
	required: false,
	description: "",
	options: [
		{
			uid: crypto.randomUUID(),
			value: "option_1",
			text: t("admin.formBuilder.option1"),
		},
	],
});

const toFieldId = (value: string): string => {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");

	if (!normalized) {
		return "field_1";
	}

	if (/^[0-9]/.test(normalized)) {
		return `field_${normalized}`;
	}

	return normalized;
};

const toOptionValue = (value: string): string => {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");

	return normalized || "option";
};

export const SimpleFormBuilder = component$<SimpleFormBuilderProps>(
	({ inputName, initialValue }) => {
		let initialFields: FieldDraft[] = [createField()];

		if (initialValue) {
			try {
				const parsed = JSON.parse(initialValue) as Array<Record<string, any>>;
				if (Array.isArray(parsed) && parsed.length > 0) {
					initialFields = parsed.map((field) => ({
						uid: crypto.randomUUID(),
						name: toFieldId(String(field.name || field.id || "")),
						title: String(field.title || ""),
						type: (field.type || "text") as FieldType,
						required: Boolean(field.required),
						description: String(field.description || field.helpText || ""),
						options: Array.isArray(field.choices)
							? field.choices
									.map((choice) => {
										const text = String(choice?.text || choice?.value || "");
										return {
											uid: crypto.randomUUID(),
											text,
											value: toOptionValue(String(choice?.value || text)),
										};
									})
									.filter((choice) => choice.text || choice.value)
							: [
									{
										uid: crypto.randomUUID(),
										value: "option_1",
										text: t("admin.formBuilder.option1"),
									},
								],
					}));
				}
			} catch {
				// Keep default field if parsing fails.
			}
		}

		const fields = useSignal<FieldDraft[]>(initialFields);

		const serialized = () =>
			JSON.stringify(
				fields.value.map((field) => ({
					name: toFieldId(field.name),
					title: field.title,
					type: field.type,
					required: field.required,
					description: field.description || undefined,
					choices:
						field.type === "radiogroup" || field.type === "select"
							? field.options
									.map((option) => ({
										value: toOptionValue(option.value || option.text),
										text: option.text.trim(),
									}))
									.filter((option) => option.text.length > 0)
							: undefined,
				})),
			);

		return (
			<div class="forms-simple-builder">
				<input type="hidden" name={inputName} value={serialized()} />

				{fields.value.map((field, index) => (
					<div key={field.uid} class="forms-simple-field-card">
						<div class="forms-simple-field-grid">
							<label class="forms-field-label">
								{t("admin.simpleFormBuilder.question")}
								<input
									class="forms-input"
									value={field.title}
									onInput$={(ev) => {
										const title = (ev.target as HTMLInputElement).value;
										const next = [...fields.value];
										next[index] = {
											...next[index],
											title,
											name: toFieldId(title),
										};
										fields.value = next;
									}}
								/>
							</label>

							<label class="forms-field-label">
								{t("admin.simpleFormBuilder.id")}
								<input
									class="forms-input"
									value={field.name}
									onInput$={(ev) => {
										const nextValue = toFieldId(
											(ev.target as HTMLInputElement).value,
										);
										const next = [...fields.value];
										next[index] = {
											...next[index],
											name: nextValue,
										};
										fields.value = next;
									}}
								/>
							</label>

							<label class="forms-field-label">
								{t("admin.simpleFormBuilder.type")}
								<select
									class="forms-select"
									value={field.type}
									onChange$={(ev) => {
										const next = [...fields.value];
										next[index] = {
											...next[index],
											type: (ev.target as HTMLSelectElement).value as FieldType,
										};
										fields.value = next;
									}}
								>
									<option value="text">
										{t("admin.simpleFormBuilder.text")}
									</option>
									<option value="textarea">
										{t("admin.simpleFormBuilder.textarea")}
									</option>
									<option value="radiogroup">
										{t("admin.simpleFormBuilder.radioGroup")}
									</option>
									<option value="select">
										{t("admin.simpleFormBuilder.selectDropdown")}
									</option>
								</select>
							</label>

							<label class="forms-field-label forms-field-checkbox">
								<input
									type="checkbox"
									checked={field.required}
									onChange$={(ev) => {
										const next = [...fields.value];
										next[index] = {
											...next[index],
											required: (ev.target as HTMLInputElement).checked,
										};
										fields.value = next;
									}}
								/>
								{t("admin.simpleFormBuilder.required")}
							</label>
						</div>

						<label class="forms-field-label">
							{t("admin.simpleFormBuilder.description")}
							<input
								class="forms-input"
								value={field.description}
								onInput$={(ev) => {
									const next = [...fields.value];
									next[index] = {
										...next[index],
										description: (ev.target as HTMLInputElement).value,
									};
									fields.value = next;
								}}
							/>
						</label>

						{(field.type === "radiogroup" || field.type === "select") && (
							<div class="forms-field-label">
								{t("admin.simpleFormBuilder.options")}
								<div class="forms-options-list">
									{field.options.map((option, optionIndex) => (
										<div key={option.uid} class="forms-options-row">
											<input
												class="forms-input"
												value={option.text}
												placeholder={t("admin.simpleFormBuilder.optionText")}
												onInput$={(ev) => {
													const text = (ev.target as HTMLInputElement).value;
													const next = [...fields.value];
													const nextOptions = [...next[index].options];
													nextOptions[optionIndex] = {
														...nextOptions[optionIndex],
														text,
														value: toOptionValue(text),
													};
													next[index] = {
														...next[index],
														options: nextOptions,
													};
													fields.value = next;
												}}
											/>
											<input
												class="forms-input"
												value={option.value}
												placeholder={t("admin.simpleFormBuilder.optionValue")}
												onInput$={(ev) => {
													const next = [...fields.value];
													const nextOptions = [...next[index].options];
													nextOptions[optionIndex] = {
														...nextOptions[optionIndex],
														value: toOptionValue(
															(ev.target as HTMLInputElement).value,
														),
													};
													next[index] = {
														...next[index],
														options: nextOptions,
													};
													fields.value = next;
												}}
											/>
											<button
												type="button"
												class="forms-button forms-button-secondary"
												onClick$={() => {
													const next = [...fields.value];
													const nextOptions = next[index].options.filter(
														(_, i) => i !== optionIndex,
													);
													next[index] = {
														...next[index],
														options:
															nextOptions.length > 0
																? nextOptions
																: [
																		{
																			uid: crypto.randomUUID(),
																			value: "option_1",
																			text: t("admin.formBuilder.option1"),
																		},
																	],
													};
													fields.value = next;
												}}
											>
												{t("admin.simpleFormBuilder.remove")}
											</button>
										</div>
									))}
								</div>
								<button
									type="button"
									class="forms-button forms-button-secondary"
									onClick$={() => {
										const next = [...fields.value];
										next[index] = {
											...next[index],
											options: [
												...next[index].options,
												{
													uid: crypto.randomUUID(),
													value: `option_${next[index].options.length + 1}`,
													text: t("admin.formBuilder.optionN", {
														value: next[index].options.length + 1,
													}),
												},
											],
										};
										fields.value = next;
									}}
								>
									{t("admin.simpleFormBuilder.addOption")}
								</button>
							</div>
						)}

						<button
							type="button"
							class="forms-button forms-button-secondary"
							onClick$={() => {
								fields.value = fields.value.filter((_, i) => i !== index);
								if (fields.value.length === 0) {
									fields.value = [createField()];
								}
							}}
						>
							{t("admin.simpleFormBuilder.removeField")}
						</button>
					</div>
				))}

				<button
					type="button"
					class="forms-button forms-button-secondary"
					onClick$={() => {
						fields.value = [
							...fields.value,
							createField(fields.value.length + 1),
						];
					}}
				>
					{t("admin.simpleFormBuilder.addField")}
				</button>
			</div>
		);
	},
);

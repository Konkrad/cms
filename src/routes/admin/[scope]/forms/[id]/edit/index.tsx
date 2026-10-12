import { component$, useSignal } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";
import { formQuestions } from "~/core/forms/answers";
import { formValidationService } from "~/core/forms/form-validation.service";
import { buildFormPath } from "~/core/forms/forms";
import { FormLockedError, formsService } from "~/core/forms/forms.service";
import { isSurveyForm } from "~/core/forms/purposes";
import { SimpleFormBuilder } from "~/core/forms/SimpleFormBuilder";
import { formPurposes, isFormPurpose } from "~/core/registry/forms";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import {
	buildFormsAdminBasePath,
	getOwnForm,
	resolveFormsAdminScope,
} from "../../_utils";

export const useForm = routeLoader$(async (event) => {
	const { scope } = await resolveFormsAdminScope(event);
	const form = await getOwnForm(scope, event.params.id);
	if (!form) {
		throw event.redirect(302, buildFormsAdminBasePath(event.params.scope));
	}

	return assertNoPrivateFields({
		form: {
			id: form.id,
			title: form.title,
			slug: form.slug,
			description: form.description,
			purpose: form.purpose,
			visibility: form.visibility,
			schema: form.schema,
		},
		// A form with answers is locked: its questions can no longer change (spec 4.10).
		locked: await formsService.isLocked(form.id),
		questions: formQuestions(form.schema).map((q) => ({
			name: q.name,
			title: q.title,
			type: q.type,
			required: q.required,
		})),
		purposes: formPurposes(),
		basePath: buildFormsAdminBasePath(event.params.scope),
		publicPath: isSurveyForm(form) ? buildFormPath(form) : null,
		simpleFields: formValidationService.extractSimpleFieldsFromSurvey(
			form.schema,
		),
	});
});

export const useUpdateForm = routeAction$(
	async (data, event) => {
		const { scope } = await resolveFormsAdminScope(event);
		const existing = await getOwnForm(scope, event.params.id);
		if (!existing) {
			return { success: false, error: "Form not found" };
		}
		if (data.purpose && !isFormPurpose(data.purpose)) {
			return { success: false, error: "Unknown purpose" };
		}
		try {
			// A locked form's edit page sends no questions; only its settings change.
			let schema: Record<string, any> | undefined;
			if (data.builderMode === "simple" && data.simpleFieldsJson) {
				const fields = formValidationService.parseSimpleFields(
					JSON.parse(data.simpleFieldsJson),
				);
				schema = formValidationService.buildSurveyJsonFromSimpleFields(
					fields,
					data.title,
					data.description || undefined,
				);
			} else if (data.builderMode === "json" && data.schemaJson) {
				schema = formValidationService.validateSurveyJson(
					JSON.parse(data.schemaJson),
				);
			}

			await formsService.update(existing.id, {
				title: data.title,
				slug: data.slug,
				description: data.description || null,
				purpose: data.purpose || null,
				visibility: data.visibility,
				...(schema ? { schema } : {}),
			});
		} catch (error) {
			if (error instanceof FormLockedError)
				return { success: false, error: error.message };
			if (error instanceof SyntaxError || error instanceof z.ZodError)
				return { success: false, error: "The questions are not valid" };
			if (error instanceof Error && !("status" in error))
				return { success: false, error: error.message };
			throw error;
		}
		throw event.redirect(303, buildFormsAdminBasePath(event.params.scope));
	},
	zod$({
		title: z.string().min(1, "Title is required"),
		slug: z
			.string()
			.min(1, "Slug is required")
			.regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, '_' and '-'."),
		description: z.string().optional(),
		purpose: z.string().optional(),
		visibility: z.enum(["private", "public"]).default("private"),
		builderMode: z.enum(["simple", "json", "locked"]).default("simple"),
		simpleFieldsJson: z.string().optional(),
		schemaJson: z.string().optional(),
	}),
);

export default component$(() => {
	const loader = useForm();
	const action = useUpdateForm();

	const defaultMode: "simple" | "json" =
		loader.value.simpleFields.length > 0 ? "simple" : "json";
	const builderMode = useSignal(
		((action.formData?.get("builderMode") as string) || defaultMode) as
			| "simple"
			| "json",
	);

	return (
		<div class="max-w-4xl mx-auto px-4 py-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-8">Edit Form</h1>

			<div class="mb-6">
				<Button
					href={`${loader.value.basePath}/${loader.value.form.id}/responses`}
					variant="secondary"
				>
					View Responses
				</Button>
			</div>

			{(action.value as { error?: string } | undefined)?.error && (
				<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm">
					{(action.value as { error?: string }).error}
				</div>
			)}

			{action.value?.failed && action.value?.formErrors?.[0] && (
				<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm">
					{action.value.formErrors[0]}
				</div>
			)}

			<Card>
				<Form action={action} class="space-y-6">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Input
							name="title"
							label="Title"
							required
							value={action.formData?.get("title") || loader.value.form.title}
							error={action.value?.fieldErrors?.title?.[0]}
						/>
						<Input
							name="slug"
							label="Slug"
							required
							value={action.formData?.get("slug") || loader.value.form.slug}
							error={action.value?.fieldErrors?.slug?.[0]}
							placeholder="signup-survey"
						/>
					</div>

					<TextArea
						name="description"
						label="Description"
						value={
							(action.formData?.get("description") as string) ||
							loader.value.form.description ||
							""
						}
						rows={3}
					/>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Select
							name="visibility"
							label="Visibility"
							value={
								(action.formData?.get("visibility") as string) ||
								loader.value.form.visibility
							}
						>
							<option value="private">Private (login required)</option>
							<option value="public">Public</option>
						</Select>

						<Select
							name="purpose"
							label="Purpose"
							value={
								(action.formData?.get("purpose") as string) ??
								loader.value.form.purpose ??
								""
							}
						>
							<option value="">None (a survey)</option>
							{loader.value.purposes.map((p) => (
								<option key={p.purpose} value={p.purpose}>
									{p.label}
								</option>
							))}
						</Select>
					</div>

					{loader.value.locked ? (
						<div data-testid="form-locked">
							<input type="hidden" name="builderMode" value="locked" />
							<div class="p-3 mb-4 rounded-sm bg-amber-50 border border-amber-300 text-amber-900 text-sm">
								This form has answers, so its questions can no longer be edited.
								Duplicate it from the forms list to change them.
							</div>
							<ol class="list-decimal pl-6 space-y-1 text-sm text-gray-700">
								{loader.value.questions.map((q) => (
									<li key={q.name}>
										{q.title}{" "}
										<span class="text-gray-400">
											({q.type}
											{q.required ? ", required" : ""})
										</span>
									</li>
								))}
							</ol>
						</div>
					) : (
						<>
							<Select
								name="builderMode"
								label="Builder Mode"
								value={builderMode.value}
								onChange$={(event) => {
									builderMode.value = (event.target as HTMLSelectElement)
										.value as "simple" | "json";
								}}
							>
								<option value="simple">Simple Builder</option>
								<option value="json">Paste SurveyJS JSON</option>
							</Select>
							{builderMode.value === "simple" ? (
								<div class="forms-builder-card">
									<p class="text-sm text-gray-600 mb-2">
										Build fields directly. IDs are auto-generated from question
										titles.
									</p>
									<SimpleFormBuilder
										inputName="simpleFieldsJson"
										initialValue={
											(action.formData?.get("simpleFieldsJson") as string) ||
											JSON.stringify(loader.value.simpleFields)
										}
									/>
								</div>
							) : (
								<TextArea
									name="schemaJson"
									label="SurveyJS JSON"
									value={
										(action.formData?.get("schemaJson") as string) ||
										JSON.stringify(loader.value.form.schema, null, 2)
									}
									rows={14}
								/>
							)}
						</>
					)}

					{loader.value.publicPath && (
						<p class="text-sm text-gray-500">
							Public URL: {loader.value.publicPath}
						</p>
					)}

					<div class="flex gap-4">
						<Button type="submit" disabled={action.isRunning}>
							{action.isRunning ? "Updating..." : "Update Form"}
						</Button>
						<Button href={loader.value.basePath} variant="secondary">
							Cancel
						</Button>
					</div>
				</Form>
			</Card>
		</div>
	);
});

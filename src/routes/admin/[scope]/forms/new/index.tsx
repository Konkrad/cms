import { component$, useComputed$, useSignal } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";
import { formValidationService } from "~/core/forms/form-validation.service";
import { buildFormPath } from "~/core/forms/forms";
import { formsService } from "~/core/forms/forms.service";
import { SimpleFormBuilder } from "~/core/forms/SimpleFormBuilder";
import { t } from "~/core/i18n";
import { formPurposes, isFormPurpose } from "~/core/registry/forms";
import { buildFormsAdminBasePath, resolveFormsAdminScope } from "../_utils";

export const useScope = routeLoader$(async (event) => {
	await resolveFormsAdminScope(event);
	return {
		basePath: buildFormsAdminBasePath(event.params.scope),
		purposes: formPurposes(),
	};
});

export const useCreateForm = routeAction$(
	async (data, event) => {
		const scope = await resolveFormsAdminScope(event);
		try {
			let schemaJson: Record<string, any>;
			if (data.builderMode === "simple") {
				const rawFields = JSON.parse(data.simpleFieldsJson || "[]");
				const fields = formValidationService.parseSimpleFields(rawFields);
				schemaJson = formValidationService.buildSurveyJsonFromSimpleFields(
					fields,
					data.title,
					data.description || undefined,
				);
			} else {
				schemaJson = formValidationService.validateSurveyJson(
					JSON.parse(data.schemaJson),
				);
			}

			if (data.purpose && !isFormPurpose(data.purpose)) {
				return { success: false, error: t("admin.forms.unknownPurpose") };
			}
			const created = await formsService.create({
				title: data.title,
				slug: data.slug,
				description: data.description || null,
				schema: schemaJson,
				purpose: data.purpose || null,
				visibility: data.visibility,
				scopeId: scope.scope.id,
				createdBy: scope.userId,
			});

			throw event.redirect(
				303,
				`${buildFormsAdminBasePath(event.params.scope)}/${created.id}/edit`,
			);
		} catch (error: any) {
			if (error?.status === 303) {
				throw error;
			}

			return {
				success: false,
				error: error?.message || t("admin.forms.createFailed"),
			};
		}
	},
	zod$({
		title: z.string().min(1, t("admin.forms.titleRequired")),
		slug: z
			.string()
			.min(1, t("admin.forms.slugRequired"))
			.regex(/^[a-z0-9_-]+$/, t("admin.forms.slugFormat")),
		description: z.string().optional(),
		visibility: z.enum(["private", "public"]).default("private"),
		builderMode: z.enum(["simple", "json"]).default("simple"),
		simpleFieldsJson: z.string().optional(),
		schemaJson: z.string().default('{"pages":[]}'),
		purpose: z.string().optional(),
	}),
);

export default component$(() => {
	const scope = useScope();
	const action = useCreateForm();
	const builderMode = useSignal(
		((action.formData?.get("builderMode") as string) || "simple") as
			| "simple"
			| "json",
	);

	const previewPath = useComputed$(() => {
		const id = (action.formData?.get("id") as string) || "<form-id>";
		const slug =
			((action.formData?.get("slug") as string) || "your-form").trim() ||
			"your-form";
		return buildFormPath({ id, slug });
	});

	return (
		<div class="max-w-4xl mx-auto px-4 py-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-8">
				{t("admin.forms.new.createNewForm")}
			</h1>

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
							label={t("admin.forms.new.title")}
							required
							value={action.formData?.get("title")}
							error={action.value?.fieldErrors?.title?.[0]}
						/>
						<Input
							name="slug"
							label={t("admin.forms.new.slug")}
							required
							value={action.formData?.get("slug")}
							error={action.value?.fieldErrors?.slug?.[0]}
							placeholder={t("admin.forms.new.signupSurvey")}
						/>
					</div>

					<TextArea
						name="description"
						label={t("admin.forms.new.description")}
						value={(action.formData?.get("description") as string) || ""}
						rows={3}
					/>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Select
							name="visibility"
							label={t("admin.forms.new.visibility")}
							value={
								(action.formData?.get("visibility") as string) || "private"
							}
						>
							<option value="private">
								{t("admin.forms.new.privateLoginRequired")}
							</option>
							<option value="public">{t("admin.forms.new.public")}</option>
						</Select>

						<Select
							name="builderMode"
							label={t("admin.forms.new.builderMode")}
							value={builderMode.value}
							onChange$={(event) => {
								builderMode.value = (event.target as HTMLSelectElement).value as
									| "simple"
									| "json";
							}}
						>
							<option value="simple">
								{t("admin.forms.new.simpleBuilder")}
							</option>
							<option value="json">
								{t("admin.forms.new.pasteSurveyjsJson")}
							</option>
						</Select>
					</div>

					{builderMode.value === "simple" ? (
						<div class="forms-builder-card">
							<p class="text-sm text-gray-600 mb-2">
								{t("admin.forms.new.buildFieldsDirectlyIdsAre")}
							</p>
							<SimpleFormBuilder
								inputName="simpleFieldsJson"
								initialValue={
									(action.formData?.get("simpleFieldsJson") as string) || "[]"
								}
							/>
						</div>
					) : (
						<TextArea
							name="schemaJson"
							label={t("admin.forms.new.surveyjsJson")}
							value={
								(action.formData?.get("schemaJson") as string) || '{"pages":[]}'
							}
							rows={14}
						/>
					)}

					<Select
						name="purpose"
						label={t("admin.forms.new.purpose")}
						value={(action.formData?.get("purpose") as string) || ""}
					>
						<option value="">{t("admin.forms.new.noneASurvey")}</option>
						{scope.value.purposes.map((p) => (
							<option key={p.purpose} value={p.purpose}>
								{p.label}
							</option>
						))}
					</Select>

					<p class="text-sm text-gray-500">
						{t("admin.forms.new.publicUrlPreview", {
							value: previewPath.value,
						})}
					</p>

					<div class="flex gap-4">
						<Button type="submit" disabled={action.isRunning}>
							{action.isRunning
								? t("admin.forms.new.creating")
								: t("admin.forms.new.createForm")}
						</Button>
						<Button href={scope.value.basePath} variant="secondary">
							{t("admin.forms.new.cancel")}
						</Button>
					</div>
				</Form>
			</Card>
		</div>
	);
});

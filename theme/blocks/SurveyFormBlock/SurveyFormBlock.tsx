import { component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";
import { SurveyRuntime } from "~/core/forms/SurveyRuntime";

export const definition: BlockDefinition = {
	name: t("theme.blocks.surveyForm.surveyForm"),
	componentType: "SurveyFormBlock",
	category: "dynamic",
	icon: "📝",
	configSchema: [
		{
			name: "formId",
			label: t("theme.blocks.surveyForm.formId"),
			type: "text",
			required: true,
			placeholder: t("theme.blocks.surveyForm.uuidOfTheForm"),
		},
		{
			name: "showTitle",
			label: t("theme.blocks.surveyForm.showFormTitle"),
			type: "boolean",
			defaultValue: true,
		},
	],
	defaultData: {
		formId: "",
		showTitle: true,
	},
};

type SurveyFormBlockProps = {
	formId: string;
	showTitle?: boolean;
};

export default component$<SurveyFormBlockProps>(
	({ formId, showTitle = true }) => {
		const formData = useSignal<{
			id: string;
			title: string;
			description: string | null;
			schemaJson: Record<string, unknown>;
			requireAltcha: boolean;
		} | null>(null);
		const error = useSignal<string>("");

		// Page builder has no route loader to supply this data via SSR.
		// biome-ignore lint/correctness/noQwikUseVisibleTask: fetches the form definition client-side, keyed off the admin-configured formId
		useVisibleTask$(async ({ track }) => {
			track(() => formId);
			if (!formId) {
				error.value = t("theme.blocks.surveyForm.formIdIsRequired");
				formData.value = null;
				return;
			}

			const response = await fetch(`/api/forms/${formId}`, {
				credentials: "same-origin",
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => ({
					error: t("theme.blocks.surveyForm.failedToLoadForm"),
				}))) as {
					error?: string;
				};
				error.value =
					payload.error || t("theme.blocks.surveyForm.failedToLoadForm");
				formData.value = null;
				return;
			}

			const payload = (await response.json()) as {
				data: {
					id: string;
					title: string;
					description: string | null;
					schemaJson: Record<string, unknown>;
					requireAltcha: boolean;
				};
			};

			formData.value = payload.data;
			error.value = "";
		});

		if (error.value) {
			return <div class="forms-alert forms-alert-error">{error.value}</div>;
		}

		if (!formData.value) {
			return (
				<div class="forms-alert forms-alert-info">
					{t("theme.surveyFormBlock.loadingForm")}
				</div>
			);
		}

		return (
			<section class="forms-embed-block">
				{showTitle && <h3 class="forms-embed-title">{formData.value.title}</h3>}
				{formData.value.description && (
					<p class="forms-embed-description">{formData.value.description}</p>
				)}
				<SurveyRuntime
					surveyJson={formData.value.schemaJson}
					submitUrl={`/api/forms/${formData.value.id}/submit`}
					requireAltcha={formData.value.requireAltcha}
				/>
			</section>
		);
	},
);

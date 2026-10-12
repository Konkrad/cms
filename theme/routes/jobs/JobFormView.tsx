import { $, component$, useSignal } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { t } from "~/contracts/i18n";
import type { JobFormAction } from "~/contracts/jobs";
import { BlockNoteEditor } from "~/core/content/editor";

export type JobFormInitialValues = {
	title: string;
	editorState: string | null;
	body: string;
	locationType: "on-site" | "remote-eu" | "remote-country";
	city: string;
	country: string;
	link: string;
	posterRelation: string;
	/** yyyy-mm-dd */
	expiresAt: string;
};

/** Shared themed form for posting (`/jobs/new`) and editing (`/jobs/mine/[id]/edit`) a job. */
export const JobFormView = component$<{
	mode: "new" | "edit";
	backHref: string;
	backLabel: string;
	heading: string;
	initial: JobFormInitialValues;
	maxDateStr: string;
	cancelHref: string;
	submitLabel: string;
	submittingLabel: string;
	action: JobFormAction;
}>(
	({
		mode,
		backHref,
		backLabel,
		heading,
		initial,
		maxDateStr,
		cancelHref,
		submitLabel,
		submittingLabel,
		action,
	}) => {
		const isSubmitting = useSignal(false);
		const locationType = useSignal(initial.locationType);
		const body = useSignal(initial.body);
		const editorState = useSignal(initial.editorState ?? "");

		const handleEditorChange$ = $((html: string, state: string) => {
			body.value = html;
			editorState.value = state;
		});

		return (
			<div class="max-w-2xl mx-auto px-4 py-8">
				<div class="mb-6">
					<a href={backHref} class="text-sm text-primary hover:text-primary">
						← {backLabel}
					</a>
				</div>

				<h1 class="text-2xl font-bold text-text-heading mb-6">{heading}</h1>

				{action.value?.failed && action.value?.error && (
					<div class="mb-6 bg-error-bg border border-error-border text-error px-4 py-3 rounded-lg">
						{action.value.error}
					</div>
				)}

				<div class="bg-white border border-border rounded-lg p-6">
					<form
						preventdefault:submit
						onSubmit$={() => {
							isSubmitting.value = true;
							const form = document.querySelector("form") as HTMLFormElement;
							if (form) action.submit(new FormData(form));
						}}
						class="space-y-6"
					>
						<Input
							name="title"
							label={t("theme.jobForm.jobTitle")}
							required
							value={initial.title}
							placeholder={t("theme.jobForm.eGSeniorFrontendEngineer")}
						/>

						<div>
							<span class="block text-sm font-medium text-text-secondary mb-2">
								{t("theme.jobForm.jobDescription")}{" "}
								<span class="text-error">*</span>
							</span>
							<div class="border border-border-strong rounded-lg overflow-hidden">
								<BlockNoteEditor
									editorState={initial.editorState}
									content={initial.body || undefined}
									onChange$={handleEditorChange$}
									textOnly
								/>
							</div>
						</div>
						<input type="hidden" name="body" value={body.value} />
						<input type="hidden" name="editorState" value={editorState.value} />

						<Select
							name="locationType"
							label={t("theme.jobForm.location")}
							value={initial.locationType}
							onChange$={(e) => {
								locationType.value = (e.target as HTMLSelectElement)
									.value as any;
							}}
						>
							<option value="on-site">{t("theme.jobForm.onSiteHybrid")}</option>
							<option value="remote-eu">
								{t("theme.jobForm.remoteEuOnly")}
							</option>
							<option value="remote-country">
								{t("theme.jobForm.remoteSpecificCountry")}
							</option>
						</Select>

						{locationType.value === "on-site" && (
							<Input
								name="city"
								label={t("theme.jobForm.city")}
								value={initial.city}
								placeholder={t("theme.jobForm.eGBerlin")}
							/>
						)}

						{(locationType.value === "on-site" ||
							locationType.value === "remote-country") && (
							<Input
								name="country"
								label={t("theme.jobForm.country")}
								value={initial.country}
								placeholder={t("theme.jobForm.eGGermany")}
							/>
						)}

						<Input
							name="link"
							label={t("theme.jobForm.applicationLinkOptional")}
							type="url"
							value={initial.link}
							placeholder={t("theme.jobForm.https")}
						/>

						<Select
							name="posterRelation"
							label={t("theme.jobForm.yourRelationToThisPosition")}
							value={initial.posterRelation}
						>
							<option value="">{t("theme.jobForm.select")}</option>
							<option value="hiring">
								{t("theme.jobForm.iMHiringForThis")}
							</option>
							<option value="founder">{t("theme.jobForm.iMTheFounder")}</option>
							<option value="direct-team">
								{t("theme.jobForm.youDBeOnMy")}
							</option>
							<option value="works-there">
								{t("theme.jobForm.iWorkThere")}
							</option>
							<option value="other">{t("theme.jobForm.other")}</option>
						</Select>

						<Input
							name="expiresAt"
							label={t("theme.jobForm.listingExpiresOn")}
							type="date"
							required
							value={initial.expiresAt}
							max={maxDateStr}
						/>

						{action.value?.failed && !action.value?.error && (
							<div class="bg-error-bg border border-error-border text-error px-4 py-3 rounded-sm">
								{t("theme.jobForm.pleaseCheckTheFormFor")}
							</div>
						)}

						<div class="flex gap-4">
							<Button type="submit" disabled={isSubmitting.value}>
								{isSubmitting.value ? submittingLabel : submitLabel}
							</Button>
							<Button href={cancelHref} variant="secondary">
								{t("theme.jobForm.cancel")}
							</Button>
						</div>
					</form>

					{mode === "new" && (
						<p class="mt-4 text-sm text-text-muted">
							{t("theme.jobForm.yourListingWillBeReviewed")}
						</p>
					)}
				</div>
			</div>
		);
	},
);

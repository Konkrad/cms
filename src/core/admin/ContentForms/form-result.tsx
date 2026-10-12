import { component$ } from "@qwik.dev/core";
import { t } from "~/core/i18n";

/** The result every note or article form action returns (besides zod's field errors). */
export type ContentFormResult = {
	success: boolean;
	error?: string;
	/** Saved but waiting for review (spec 4.9): published once a reviewer approves it. */
	inReview?: boolean;
};

export type ContentFormActionValue =
	| (ContentFormResult & { failed?: undefined; fieldErrors?: undefined })
	| {
			failed: true;
			fieldErrors: Partial<Record<string, string>>;
			formErrors?: string[];
			success?: undefined;
			error?: undefined;
			inReview?: undefined;
	  };

/** Field errors, the service's error or the success message of a note or article form. */
export const FormMessages = component$<{
	value: ContentFormActionValue | undefined;
	successMessage?: string;
}>(({ value, successMessage }) => (
	<>
		{value?.failed && (
			<div
				class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm"
				role="alert"
			>
				{Object.values(value.fieldErrors).join(" ")}
			</div>
		)}
		{value?.error && (
			<div
				class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm"
				role="alert"
			>
				{value.error}
			</div>
		)}
		{value?.success && value.inReview && (
			<output
				class="block bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-sm"
				data-testid="sent-for-review"
			>
				{t("admin.formResult.sentForReviewItIs")}
			</output>
		)}
		{value?.success && !value.inReview && successMessage && (
			<output class="block bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-sm">
				{successMessage}
			</output>
		)}
	</>
));

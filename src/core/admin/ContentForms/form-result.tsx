import { component$ } from "@qwik.dev/core";

/** The result every note or article form action returns (besides zod's field errors). */
export type ContentFormResult = { success: boolean; error?: string };

export type ContentFormActionValue =
	| (ContentFormResult & { failed?: undefined; fieldErrors?: undefined })
	| {
			failed: true;
			fieldErrors: Partial<Record<string, string>>;
			formErrors?: string[];
			success?: undefined;
			error?: undefined;
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
		{value?.success && successMessage && (
			<output class="block bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-sm">
				{successMessage}
			</output>
		)}
	</>
));

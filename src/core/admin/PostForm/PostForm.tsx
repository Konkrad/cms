import { component$, useSignal } from "@qwik.dev/core";
import { type ActionStore, Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { VisibilitySelector } from "~/core/admin/VisibilitySelector";
import { BlockNoteEditor } from "~/core/content/editor";
import type { Visibility } from "~/core/scopes/visibility";
import { SubjectPicker } from "./SubjectPicker";

/** The result every post form action returns (besides zod's field errors). */
export type PostFormResult = { success: boolean; error?: string };

type PostFormActionValue =
	| (PostFormResult & { failed?: undefined; fieldErrors?: undefined })
	| {
			failed: true;
			fieldErrors: Partial<Record<string, string>>;
			formErrors?: string[];
			success?: undefined;
			error?: undefined;
	  };

export interface PostFormValues {
	title: string | null;
	/** Stored HTML; the editor parses it into blocks. */
	body: string;
	visibility: Visibility;
	/** The current subject (`ref:<module>:<type>:<id>` and a label), if any. */
	subject?: { href: string; label: string } | null;
}

/**
 * The admin post editor (spec 4.4): optional title (none = a note, a title = an article),
 * body, visibility (the options the user may use on the scope: `allowedVisibilities`) and,
 * with `subjectPicker`, the item the post is about. Posts `title`, `body`, `visibility` and
 * `subject` to `action`; the action authorizes and validates (`posts.create` / `update`).
 * Used by the core post admin and by modules (`~/core/ui`, e.g. an event's Posts tab).
 */
export const PostForm = component$<{
	// biome-ignore lint/suspicious/noExplicitAny: any action whose result is a PostFormActionValue
	action: ActionStore<PostFormActionValue, any, any>;
	visibilities: readonly Visibility[];
	values?: PostFormValues;
	subjectPicker?: boolean;
	submitLabel?: string;
	cancelHref?: string;
	successMessage?: string;
}>((props) => {
	const body = useSignal(props.values?.body ?? "");
	const values = props.values;
	return (
		<Form action={props.action} class="space-y-6" data-testid="post-form">
			<Input
				name="title"
				label="Title (optional)"
				value={values?.title ?? ""}
				placeholder="Leave empty for a short note"
			/>
			<p class="-mt-4 text-xs text-gray-500">
				Without a title the post is shown as a note; with one, as an article.
			</p>

			<div>
				<p class="block text-sm font-medium text-gray-700 mb-2">Text</p>
				<div class="border border-gray-300 rounded-lg overflow-hidden">
					<BlockNoteEditor
						editorState={null}
						content={values?.body ?? ""}
						onChange$={(html: string) => {
							body.value = html;
						}}
						uploadUrl="/api/images"
						linkPicker
					/>
				</div>
				<input type="hidden" name="body" value={body.value} />
			</div>

			{props.subjectPicker && <SubjectPicker value={values?.subject ?? null} />}

			<VisibilitySelector
				name="visibility"
				value={
					values && props.visibilities.includes(values.visibility)
						? values.visibility
						: props.visibilities[0]
				}
				options={props.visibilities}
			/>

			{props.action.value?.failed && (
				<div
					class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm"
					role="alert"
				>
					{Object.values(props.action.value.fieldErrors).join(" ")}
				</div>
			)}
			{props.action.value?.error && (
				<div
					class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm"
					role="alert"
				>
					{props.action.value.error}
				</div>
			)}
			{props.action.value?.success && props.successMessage && (
				<output class="block bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-sm">
					{props.successMessage}
				</output>
			)}

			<div class="flex gap-4">
				<Button type="submit" disabled={props.action.isRunning}>
					{props.action.isRunning ? "Saving..." : (props.submitLabel ?? "Save")}
				</Button>
				{props.cancelHref && (
					<Button href={props.cancelHref} variant="secondary">
						Cancel
					</Button>
				)}
			</div>
		</Form>
	);
});

import { component$, useSignal } from "@qwik.dev/core";
import { type ActionStore, Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { VisibilitySelector } from "~/core/admin/VisibilitySelector";
import { NOTE_MAX_LENGTH, toPlainText } from "~/core/content/content-items";
import { BlockNoteEditor } from "~/core/content/editor";
import type { Visibility } from "~/core/scopes/visibility";
import { type ContentFormActionValue, FormMessages } from "./form-result";
import { SubjectPicker } from "./SubjectPicker";

export interface NoteFormValues {
	/** Stored HTML; the editor parses it into blocks. */
	body: string;
	visibility: Visibility;
	/** The current subject (`ref:<module>:<type>:<id>` and a label), if any. */
	subject?: { href: string; label: string } | null;
}

/**
 * The quick note form (spec 4.4): short text with links, no title, no image; at most
 * `NOTE_MAX_LENGTH` characters (counted here, enforced by the notes service), visibility (the
 * options the user may use on the scope: `allowedVisibilities`) and, with `subjectPicker`, the
 * item the note is about. Posts `body`, `visibility` and `subject` to `action`; the action
 * authorizes and validates (`notes.create` / `update`). Used by the core notes admin and by
 * modules (`~/core/ui`, e.g. an event's Updates tab).
 */
export const NoteForm = component$<{
	// biome-ignore lint/suspicious/noExplicitAny: any action whose result is a ContentFormActionValue
	action: ActionStore<ContentFormActionValue, any, any>;
	visibilities: readonly Visibility[];
	values?: NoteFormValues;
	subjectPicker?: boolean;
	submitLabel?: string;
	cancelHref?: string;
	successMessage?: string;
}>((props) => {
	const body = useSignal(props.values?.body ?? "");
	const length = toPlainText(body.value).length;
	const values = props.values;
	return (
		<Form action={props.action} class="space-y-4" data-testid="note-form">
			<div>
				<p class="block text-sm font-medium text-gray-700 mb-2">Note</p>
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
				<p
					class={`mt-1 text-xs ${length > NOTE_MAX_LENGTH ? "text-red-600" : "text-gray-500"}`}
					data-testid="note-length"
				>
					{length} / {NOTE_MAX_LENGTH} characters. Text and links only; for
					more, write an article.
				</p>
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

			<FormMessages
				value={props.action.value}
				successMessage={props.successMessage}
			/>

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

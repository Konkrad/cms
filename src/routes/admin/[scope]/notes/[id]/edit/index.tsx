import { component$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import type { ContentFormResult } from "~/core/admin/ContentForms/form-result";
import { NoteForm } from "~/core/admin/ContentForms/NoteForm";
import { noteFormSchema, subjectFromField } from "~/core/content/content-form";
import { ContentInputError } from "~/core/content/content-items";
import { notesService } from "~/core/content/notes.service";
import { subjectFieldValue } from "~/core/content/stream-cards";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	allowedVisibilities,
	isWithinScope,
	requireScopeRole,
} from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

export const useNote = routeLoader$(async (event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const note = await notesService.getById(event.params.id);
	if (!note) throw event.redirect(303, adminUrl(scope.path, "/notes"));
	if (!(await isWithinScope(scope, note.scopeId)))
		throw event.error(403, "Forbidden");
	// The current visibility stays selectable (unchanged values are not re-checked).
	const allowed = await allowedVisibilities(user, note.scopeId);
	return assertNoPrivateFields({
		base: adminUrl(scope.path),
		visibilities: [...new Set([note.visibility, ...allowed])],
		note: {
			id: note.id,
			body: note.body,
			visibility: note.visibility,
			subject: await subjectFieldValue(note),
		},
	});
});

export const useUpdateNote = routeAction$(
	async (data, event): Promise<ContentFormResult> => {
		const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
		const target = await notesService.getById(event.params.id);
		if (!target) return { success: false, error: "Note not found" };
		if (!(await isWithinScope(scope, target.scopeId)))
			throw event.error(403, "Forbidden");
		try {
			const saved = await notesService.update(
				target.id,
				{
					body: data.body,
					visibility: data.visibility,
					...subjectFromField(data.subject),
				},
				user.id,
			);
			return { success: true, inReview: !!saved && !saved.publishedAt };
		} catch (error) {
			if (error instanceof ContentInputError)
				return { success: false, error: error.message };
			throw error;
		}
	},
	zod$(noteFormSchema),
);

export default component$(() => {
	const data = useNote();
	const updateNote = useUpdateNote();
	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">Edit note</h2>
				<Button href={`${data.value.base}/notes`} variant="secondary">
					Back to Notes
				</Button>
			</div>
			<div class="bg-white rounded-lg shadow-sm p-6">
				<NoteForm
					action={updateNote}
					visibilities={data.value.visibilities}
					values={data.value.note}
					subjectPicker
					submitLabel="Save Changes"
					cancelHref={`${data.value.base}/notes`}
					successMessage="Note updated."
				/>
			</div>
		</div>
	);
});

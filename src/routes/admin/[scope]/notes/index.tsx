import { component$ } from "@qwik.dev/core";
import {
	Form,
	Link,
	routeAction$,
	routeLoader$,
	z,
	zod$,
} from "@qwik.dev/router";
import { format } from "date-fns";
import type { ContentFormResult } from "~/core/admin/ContentForms/form-result";
import { NoteForm } from "~/core/admin/ContentForms/NoteForm";
import { PAGE_SIZE, Pagination } from "~/core/admin/Pagination/Pagination";
import { SearchBar } from "~/core/admin/SearchBar/SearchBar";
import { noteFormSchema } from "~/core/content/content-form";
import { ContentInputError } from "~/core/content/content-items";
import { notesService } from "~/core/content/notes.service";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	allowedVisibilities,
	isWithinScope,
	requireScopeRole,
} from "~/core/scopes/access";
import { scopesService } from "~/core/scopes/scopes.service";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

export const useNotes = routeLoader$(async (event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const { url } = event;
	const isRoot = scope.parentId === null;
	const search = url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(
		1,
		parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
	);

	const { total, items } = await notesService.adminList({
		// The root lists every note; other scopes their own and their subtree's.
		scopeIds: isRoot ? null : await scopesService.subtreeIds(scope.id),
		search,
		limit: PAGE_SIZE,
		offset: (page - 1) * PAGE_SIZE,
	});

	return assertNoPrivateFields({
		notes: items,
		total,
		page,
		pageSize: PAGE_SIZE,
		search,
		isRoot,
		base: adminUrl(scope.path),
		visibilities: await allowedVisibilities(user, scope.id),
	});
});

/** The quick form: a note in the admin URL's scope; the service checks visibility and length. */
export const useCreateNote = routeAction$(
	async (data, event): Promise<ContentFormResult> => {
		const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
		try {
			await notesService.create({
				scopeId: scope.id,
				body: data.body,
				visibility: data.visibility,
				authorId: user.id,
			});
		} catch (error) {
			if (error instanceof ContentInputError)
				return { success: false, error: error.message };
			throw error;
		}
		return { success: true };
	},
	zod$(noteFormSchema),
);

export const useDeleteNote = routeAction$(
	async (data, event) => {
		const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
		const target = await notesService.getById(data.noteId);
		if (!target) throw event.error(404, "Note not found");
		if (!(await isWithinScope(scope, target.scopeId)))
			throw event.error(403, "Forbidden");
		await notesService.delete(target.id);
		return { success: true };
	},
	zod$({ noteId: z.string().min(1) }),
);

export default component$(() => {
	const data = useNotes();
	const createNote = useCreateNote();
	const deleteNote = useDeleteNote();
	const totalPages = Math.ceil(data.value.total / data.value.pageSize);

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">
					{data.value.isRoot ? "All Notes" : "Group Notes"}
				</h2>
			</div>

			<div class="bg-white rounded-lg shadow-sm p-6 mb-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-3">Write a note</h3>
				{/* Re-created after each new note, so the editor starts empty again. */}
				<NoteForm
					key={`note-form-${data.value.total}`}
					action={createNote}
					visibilities={data.value.visibilities}
					submitLabel="Publish note"
				/>
			</div>

			<SearchBar value={data.value.search} placeholder="Search notes…" />

			<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Note
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Author
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Published
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{data.value.notes.map((note) => (
							<tr key={note.id} class="hover:bg-gray-50">
								<td class="px-6 py-4 text-sm text-gray-900">
									<div class="line-clamp-2">{note.excerpt}</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{note.author.name} {note.author.familyName}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{note.publishedAt
										? format(new Date(note.publishedAt), "MMM d, yyyy")
										: "Not published"}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
									<div class="flex items-center gap-4">
										<Link
											href={`${data.value.base}/notes/${note.id}/edit`}
											class="text-blue-600 hover:text-blue-900"
										>
											Edit
										</Link>
										<Form action={deleteNote}>
											<input type="hidden" name="noteId" value={note.id} />
											<button
												type="submit"
												preventdefault:click
												class="text-red-600 hover:text-red-900"
												onClick$={(e) => {
													if (!confirm("Delete this note?")) return;
													(e.target as HTMLElement)
														.closest("form")
														?.requestSubmit();
												}}
											>
												Delete
											</button>
										</Form>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{data.value.notes.length === 0 && (
					<div class="text-center py-12 text-gray-500">
						{data.value.search
							? `No notes matching "${data.value.search}".`
							: "No notes yet."}
					</div>
				)}
				<Pagination
					page={data.value.page}
					totalPages={totalPages}
					total={data.value.total}
					pageSize={data.value.pageSize}
				/>
			</div>
		</div>
	);
});

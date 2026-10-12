import type { StreamItemData } from "~/contracts/stream";
import {
	type ArticleInput,
	articlesService,
} from "~/core/content/articles.service";
import { textExcerpt } from "~/core/content/content-items";
import { type NoteInput, notesService } from "~/core/content/notes.service";
import { stream } from "~/core/content/stream.service";
import { toStreamCards } from "~/core/content/stream-cards";
import { itemUrl } from "~/core/registry/refs";
import { reviews } from "~/core/reviews/reviews";

/**
 * The notes and articles API for modules (`notes`, `articles`, `updatesFor` from `~/core`).
 * Server-only. A module attaches notes and articles to its items with a subject
 * (`subjectType` = `<module>:<type>`, e.g. `events:event`) instead of keeping an updates table
 * of its own, and shows them on the item's page with `updatesFor`.
 *
 * Authorization is the caller's: call these from loaders and actions that already ran
 * `requireModuleAdmin` / `requireScopeRole` (create, update, delete) or checked that the viewer
 * may see the item (`updatesFor`). The services still validate what no caller can be trusted
 * with: the scope, the visibility (`allowedVisibilities` for the author), the subject
 * reference, the article image key, and they sanitize the body.
 */

type Subject = { subjectType: string; subjectId: string };

const isAbout = (
	item: { subjectType: string | null; subjectId: string | null },
	subject?: Subject,
) =>
	!subject ||
	(item.subjectType === subject.subjectType &&
		item.subjectId === subject.subjectId);

/** One row of an item's admin list of updates (author names only). */
export type AdminUpdate = {
	type: "note" | "article";
	id: string;
	title: string | null;
	excerpt: string;
	visibility: NoteInput["visibility"];
	publishedAt: string | null;
	authorName: string;
	/** The review state when it was submitted (`in_review`, `rejected`, …), else null. */
	reviewStatus: string | null;
	reviewComment: string | null;
};

export const notes = {
	/**
	 * Creates a note by `authorId`, published at once unless it needs review (a public note by
	 * an author below coordinator of the scope: `inReview`, published on approval). Throws
	 * `ContentInputError` for bad input.
	 */
	async create(
		input: NoteInput & { authorId: string },
	): Promise<{ id: string; url: string; inReview: boolean }> {
		const note = await notesService.create(input);
		return {
			id: note.id,
			url: await itemUrl("core:note", note),
			inReview: !note.publishedAt,
		};
	},

	/** Updates body, visibility or subject; `editorId` is checked like an author. */
	update: (
		id: string,
		input: Partial<Omit<NoteInput, "scopeId">>,
		editorId: string,
	) => notesService.update(id, input, editorId),

	/**
	 * Deletes a note. With `subject`, only when the note is about that item (an item's admin page
	 * deleting "its" notes by id); returns whether a note was deleted.
	 */
	async delete(id: string, subject?: Subject): Promise<boolean> {
		const note = await notesService.getById(id);
		if (!note || !isAbout(note, subject)) return false;
		await notesService.delete(id);
		return true;
	},

	/** The published notes about an item that `viewer` may see, newest first, as cards. */
	async forSubject(
		subjectType: string,
		subjectId: string,
		viewer: { id: string } | null,
	): Promise<StreamItemData[]> {
		const rows = await stream.forSubject(subjectType, subjectId, viewer, {
			types: ["note"],
		});
		return toStreamCards(rows, { loggedIn: !!viewer });
	},
};

export const articles = {
	/** Creates an article by `authorId`, like `notes.create` (review included). */
	async create(
		input: ArticleInput & { authorId: string },
	): Promise<{ id: string; url: string; inReview: boolean }> {
		const article = await articlesService.create(input);
		return {
			id: article.id,
			url: await itemUrl("core:article", article),
			inReview: !article.publishedAt,
		};
	},

	/** Updates title, image, body, visibility or subject; `editorId` is checked like an author. */
	update: (
		id: string,
		input: Partial<Omit<ArticleInput, "scopeId">>,
		editorId: string,
	) => articlesService.update(id, input, editorId),

	/** Deletes an article; with `subject`, only one about that item. */
	async delete(id: string, subject?: Subject): Promise<boolean> {
		const article = await articlesService.getById(id);
		if (!article || !isAbout(article, subject)) return false;
		await articlesService.delete(id);
		return true;
	},

	/** The published articles about an item that `viewer` may see, newest first, as cards. */
	async forSubject(
		subjectType: string,
		subjectId: string,
		viewer: { id: string } | null,
	): Promise<StreamItemData[]> {
		const rows = await stream.forSubject(subjectType, subjectId, viewer, {
			types: ["article"],
		});
		return toStreamCards(rows, { loggedIn: !!viewer });
	},
};

/**
 * The updates about an item: its published notes and articles that `viewer` may see (each
 * item's own visibility), merged newest first, as theme payloads with public authors.
 */
export async function updatesFor(
	subjectType: string,
	subjectId: string,
	viewer: { id: string } | null,
): Promise<StreamItemData[]> {
	const rows = await stream.forSubject(subjectType, subjectId, viewer);
	return toStreamCards(rows, { loggedIn: !!viewer });
}

/**
 * Every note and article about an item whatever its visibility, newest first, for the item's
 * admin page (callers are managers of the item's scope). Author names only.
 */
export async function adminUpdatesFor(
	subjectType: string,
	subjectId: string,
): Promise<AdminUpdate[]> {
	const rows = await stream.listForSubject(subjectType, subjectId);
	const statuses = await reviews.statusOfMany(
		rows.map((r) => `core:${r.type}:${r.id}`),
	);
	return rows.map((r) => ({
		type: r.type,
		id: r.id,
		title: r.type === "article" ? r.title : null,
		excerpt: textExcerpt(r.body, 120),
		visibility: r.visibility,
		publishedAt: r.publishedAt,
		authorName: `${r.author.name} ${r.author.familyName}`,
		reviewStatus: statuses.get(`core:${r.type}:${r.id}`)?.status ?? null,
		reviewComment: statuses.get(`core:${r.type}:${r.id}`)?.comment ?? null,
	}));
}

export { ContentInputError } from "~/core/content/content-items";
export type { ArticleInput, NoteInput };

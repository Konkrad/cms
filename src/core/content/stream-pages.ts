import type { RequestEventLoader } from "@qwik.dev/router";
import type { ArticleViewData } from "~/contracts/articles";
import type { NoteViewData } from "~/contracts/notes";
import type { StreamItemData } from "~/contracts/stream";
import { getCurrentUserData } from "~/core/auth/server-auth";
import { articlesService } from "~/core/content/articles.service";
import { textExcerpt } from "~/core/content/content-items";
import { notesService } from "~/core/content/notes.service";
import { stream } from "~/core/content/stream.service";
import {
	contentSubject,
	toContentAuthor,
	toStreamCards,
} from "~/core/content/stream-cards";
import { publicImageUrlFromKey } from "~/core/media/images";
import { requireCanonicalUrl } from "~/core/refs/canonical";
import { itemUrl, renderRichHtml } from "~/core/registry/refs";
import { definePage } from "~/core/router/pages";
import { scopeContentFilter } from "~/core/scopes/content-filter";

/**
 * Note and article pages, served by the catch-all at their canonical URL under the owning
 * scope (`/germany/berlin/notes/<id>`, `/germany/berlin/articles/<id>`); under any other scope
 * prefix they answer 301 there. Server-only (the views are in `stream-views.tsx`).
 */

/** Related: the newest items of the item's own scope listing, as this viewer sees it. */
async function related(
	viewer: { id: string } | null,
	item: { id: string; scopeId: string },
): Promise<StreamItemData[]> {
	const recent = await stream.recent(
		await scopeContentFilter(viewer, item.scopeId),
		4,
	);
	return toStreamCards(recent.filter((r) => r.id !== item.id).slice(0, 3), {
		loggedIn: !!viewer,
	});
}

async function viewer(event: RequestEventLoader) {
	return getCurrentUserData(event);
}

export const notePage = definePage({
	id: "core.note",
	path: "/notes/:id",
	async load(event, { params }): Promise<NoteViewData | null> {
		const note = await notesService.getById(params.id);
		const user = await viewer(event);
		if (!note || !(await notesService.canView(note, user))) {
			event.status(404);
			return null;
		}
		const url = await itemUrl("core:note", note);
		requireCanonicalUrl(event, url);
		// The service returns the author's public shape only; the theme sees exactly
		// NoteViewData (see ~/contracts/notes).
		return {
			id: note.id,
			url,
			// Stored `ref:` links get their current URL; links to items that are gone are dropped.
			body: await renderRichHtml(note.body),
			excerpt: textExcerpt(note.body, 160),
			publishedAt: note.publishedAt ?? note.updatedAt,
			updatedAt: note.updatedAt,
			visibility: note.visibility,
			author: {
				...toContentAuthor(note.author, !!user),
				avatarUrl: note.author.profilePictureSmallUrl,
			},
			subject: await contentSubject(note),
			related: await related(user, note),
		};
	},
});

export const articlePage = definePage({
	id: "core.article",
	path: "/articles/:id",
	async load(event, { params }): Promise<ArticleViewData | null> {
		const article = await articlesService.getById(params.id);
		const user = await viewer(event);
		if (!article || !(await articlesService.canView(article, user))) {
			event.status(404);
			return null;
		}
		const url = await itemUrl("core:article", article);
		requireCanonicalUrl(event, url);
		return {
			id: article.id,
			url,
			title: article.title,
			body: await renderRichHtml(article.body),
			excerpt: textExcerpt(article.body, 160),
			imageUrl: publicImageUrlFromKey(article.featuredImage),
			publishedAt: article.publishedAt ?? article.updatedAt,
			updatedAt: article.updatedAt,
			visibility: article.visibility,
			author: {
				...toContentAuthor(article.author, !!user),
				avatarUrl: article.author.profilePictureSmallUrl,
			},
			subject: await contentSubject(article),
			related: await related(user, article),
		};
	},
});

/**
 * Old post URLs (`<scope>/posts/<id>`, before notes and articles): the migration kept the ids,
 * so a post the viewer may see answers 301 to its note or article URL; anything else is a 404
 * (a members-only item's scope path is not revealed). External links and bookmarks keep
 * working; internal links are references and never need this.
 */
export const legacyPostPage = definePage({
	id: "core.legacy-post",
	path: "/posts/:id",
	async load(event, { params }): Promise<null> {
		const user = await viewer(event);
		const note = await notesService.getById(params.id);
		if (note && (await notesService.canView(note, user)))
			throw event.redirect(301, await itemUrl("core:note", note));
		const article = note ? undefined : await articlesService.getById(params.id);
		if (article && (await articlesService.canView(article, user)))
			throw event.redirect(301, await itemUrl("core:article", article));
		event.status(404);
		return null;
	},
});

/** Core pages the catch-all serves at the root and under every scope prefix. */
export const corePages = [notePage, articlePage, legacyPostPage];

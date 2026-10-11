import type { ArticleCardData } from "~/contracts/articles";
import type { NoteCardData } from "~/contracts/notes";
import type { ContentSubject, StreamItemData } from "~/contracts/stream";
import { textExcerpt } from "~/core/content/content-items";
import type { StreamRow } from "~/core/content/stream.service";
import { publicImageUrlFromKey } from "~/core/media/images";
import { refHref } from "~/core/refs/refs";
import {
	describeRef,
	renderRichHtmlList,
	withItemUrls,
} from "~/core/registry/refs";
import { buildProfileUrl } from "~/core/users/format";
import type { PublicUser } from "~/core/users/public-user";

/**
 * Server-only: notes and articles as the theme gets them (`StreamItemData`,
 * ~/contracts/stream). Notes carry their whole body with current link URLs, articles an
 * excerpt and their image URL.
 */

/** The author as a viewer may see them: first name for guests, full name when logged in. */
export function toContentAuthor(author: PublicUser, loggedIn: boolean) {
	return {
		id: author.id,
		displayName: loggedIn ? `${author.name} ${author.familyName}` : author.name,
		profileUrl: buildProfileUrl(author),
	};
}

export async function toStreamCards(
	rows: readonly StreamRow[],
	options: { loggedIn: boolean; sources?: Record<string, string> },
): Promise<StreamItemData[]> {
	const notes = rows.filter((r) => r.type === "note");
	const articles = rows.filter((r) => r.type === "article");
	const [noteUrls, articleUrls, bodies] = await Promise.all([
		withItemUrls("core:note", notes),
		withItemUrls("core:article", articles),
		renderRichHtmlList(notes.map((n) => n.body)),
	]);
	const cards = new Map<string, StreamItemData>();
	noteUrls.forEach((n, i) => {
		const card: NoteCardData = {
			type: "note",
			id: n.id,
			url: n.url,
			body: bodies[i],
			publishedAt: n.publishedAt ?? n.updatedAt,
			visibility: n.visibility,
			author: toContentAuthor(n.author, options.loggedIn),
			source: options.sources?.[n.scopeId] ?? null,
		};
		cards.set(`note:${n.id}`, card);
	});
	for (const a of articleUrls) {
		const card: ArticleCardData = {
			type: "article",
			id: a.id,
			url: a.url,
			title: a.title,
			excerpt: textExcerpt(a.body, 180),
			imageUrl: publicImageUrlFromKey(a.featuredImage),
			publishedAt: a.publishedAt ?? a.updatedAt,
			visibility: a.visibility,
			author: toContentAuthor(a.author, options.loggedIn),
			source: options.sources?.[a.scopeId] ?? null,
		};
		cards.set(`article:${a.id}`, card);
	}
	return rows.flatMap((r) => cards.get(`${r.type}:${r.id}`) ?? []);
}

/**
 * The item a note or an article is about, as a link: its current URL and title, or null when
 * the reference no longer resolves (the item is gone or its module is inactive).
 */
export async function contentSubject(item: {
	subjectType: string | null;
	subjectId: string | null;
}): Promise<ContentSubject | null> {
	if (!item.subjectType || !item.subjectId) return null;
	const ref = `${item.subjectType}:${item.subjectId}`;
	const described = await describeRef(ref);
	return described
		? { url: described.url, title: described.title ?? ref }
		: null;
}

/** The subject field of an admin edit form: the stored reference and its label. */
export async function subjectFieldValue(item: {
	subjectType: string | null;
	subjectId: string | null;
}): Promise<{ href: string; label: string } | null> {
	if (!item.subjectType || !item.subjectId) return null;
	const ref = `${item.subjectType}:${item.subjectId}`;
	const described = await describeRef(ref);
	return {
		href: refHref(ref),
		label: described?.title ?? `${ref} (unavailable)`,
	};
}

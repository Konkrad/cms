import { component$ } from "@qwik.dev/core";
import type { ArticleViewData } from "~/contracts/articles";
import type { NoteViewData } from "~/contracts/notes";
import { canonicalUrl, jsonLdScript } from "~/core/content/seo";
import { t } from "~/core/i18n";
import type { PageViews } from "~/core/router/page-views";
import { ArticleView } from "~theme/routes/articles/ArticleView";
import { NoteView } from "~theme/routes/notes/NoteView";

const NotePage = component$<{ data: NoteViewData | null }>(({ data }) => (
	<NoteView note={data} />
));

const ArticlePage = component$<{ data: ArticleViewData | null }>(({ data }) => (
	<ArticleView article={data} />
));

/** A note has no title: its page title is the start of its text. */
function noteTitle(note: NoteViewData): string {
	const text = note.excerpt;
	return text.length > 60 ? `${text.slice(0, 59).trimEnd()}…` : text;
}

function noteHead(data: unknown, url: URL) {
	const note = data as NoteViewData | null;
	if (!note) return { title: t("core.content.noteNotFound") };
	const canonical = canonicalUrl(url.pathname, url.origin);
	const title = noteTitle(note);
	return {
		title,
		meta: [
			{ name: "description", content: note.excerpt },
			{ property: "og:type", content: "article" },
			{ property: "og:title", content: title },
			{ property: "og:description", content: note.excerpt },
			{ property: "og:url", content: canonical },
		],
		links: [{ rel: "canonical", href: canonical }],
		scripts: [
			jsonLdScript({
				"@context": "https://schema.org",
				// A note is a short social post.
				"@type": "SocialMediaPosting",
				articleBody: note.excerpt,
				datePublished: note.publishedAt,
				dateModified: note.updatedAt,
				author: { "@type": "Person", name: note.author.displayName },
			}),
		],
	};
}

function articleHead(data: unknown, url: URL) {
	const article = data as ArticleViewData | null;
	if (!article) return { title: t("core.content.articleNotFound") };
	const canonical = canonicalUrl(url.pathname, url.origin);
	return {
		title: article.title,
		meta: [
			{ name: "description", content: article.excerpt },
			{ property: "og:type", content: "article" },
			{ property: "og:title", content: article.title },
			{ property: "og:description", content: article.excerpt },
			{ property: "og:url", content: canonical },
			...(article.imageUrl
				? [{ property: "og:image", content: article.imageUrl }]
				: []),
		],
		links: [{ rel: "canonical", href: canonical }],
		scripts: [
			jsonLdScript({
				"@context": "https://schema.org",
				"@type": "Article",
				headline: article.title,
				image: article.imageUrl ?? undefined,
				datePublished: article.publishedAt,
				dateModified: article.updatedAt,
				author: { "@type": "Person", name: article.author.displayName },
			}),
		],
	};
}

/** Views of the core pages served by the catch-all (client-safe). */
export const coreViews: PageViews = {
	"core.note": { view: NotePage, head: noteHead },
	"core.article": { view: ArticlePage, head: articleHead },
};

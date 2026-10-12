import type { RequestEvent } from "@qwik.dev/router";
import {
	assertNoPrivateFields,
	getSiteInfo,
	getSocialWebSettings,
	publicFeed,
	requireActiveModule,
	type StreamType,
} from "~/core";
import { sendCached } from "./http";
import { type FeedItem, toFeedItems } from "./items";
import { type RssItem, renderRss } from "./rss";
import { absoluteUrl, FEED_PATH, MODULE_ID, siteBase } from "./urls";

/** Items in the feed: the newest public notes and articles. */
export const FEED_LIMIT = 50;

/** `?kind=` of the feed (spec 5.3): short = notes, long = articles, none = both. */
export function feedTypes(kind: string | null): StreamType[] | null {
	if (kind === null || kind === "") return ["note", "article"];
	if (kind === "short") return ["note"];
	if (kind === "long") return ["article"];
	return null;
}

/** A note keeps its whole text in `<description>` and gets no title; an article gets both. */
export function toRssItem(item: FeedItem): RssItem {
	const isArticle = item.type === "article";
	return {
		title: item.title,
		link: item.url,
		guid: item.objectId,
		description: isArticle ? item.excerpt : item.html,
		descriptionIsHtml: !isArticle,
		content: isArticle ? item.html : null,
		author: item.authorName,
		pubDate: item.publishedAt,
		image: item.image
			? { url: item.image.url, type: item.image.mediaType }
			: null,
	};
}

/**
 * `GET /feed.xml[?kind=short|long]`: RSS 2.0 of the site's public, approved notes and articles,
 * built on request, with ETag / Last-Modified and 304 answers. Public on purpose (it lists
 * only what a guest sees on the site); 404 while the module is inactive.
 */
export async function handleFeedGet(event: RequestEvent): Promise<void> {
	requireActiveModule(event, MODULE_ID);
	const kind = event.url.searchParams.get("kind");
	const types = feedTypes(kind);
	if (!types) throw event.error(400, 'Unknown kind (use "short" or "long")');
	const version = await publicFeed.version(types);
	const selfUrl = absoluteUrl(kind ? `${FEED_PATH}?kind=${kind}` : FEED_PATH);
	await sendCached(
		event,
		{
			etag: `"rss-${kind || "all"}-${version.tag}"`,
			lastModified: version.lastModified,
		},
		async () => {
			const items = assertNoPrivateFields(
				(
					await toFeedItems(
						await publicFeed.items({ types, limit: FEED_LIMIT }),
					)
				).map(toRssItem),
			);
			const site = getSiteInfo();
			const body = renderRss(
				{
					title: site.name,
					link: `${siteBase()}/`,
					description: getSocialWebSettings().summary || site.name,
					selfUrl,
					lastBuildDate: version.lastModified,
					language: "en",
				},
				items,
			);
			return { body, contentType: "application/rss+xml; charset=utf-8" };
		},
	);
}

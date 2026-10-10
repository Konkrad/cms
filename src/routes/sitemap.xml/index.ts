import type { RequestHandler } from "@qwik.dev/router";
import { and, eq } from "drizzle-orm";
import { sitemapEntriesOf } from "~/core/modules";
import { activeModules } from "~/core/registry/manifests";
import { db } from "~/db/connection";
import { menuItems, pages } from "~/db/schema";
import { env } from "~/env";
import { groupsService } from "~/services/groups.service";
import { postsService } from "~/services/posts.service";
import { eventsService } from "~modules/events/services/events";

interface SitemapEntry {
	loc: string;
	lastmod?: string;
}

function toXml(entries: SitemapEntry[]): string {
	const urlTags = entries
		.map((entry) => {
			const lastmod = entry.lastmod
				? `<lastmod>${entry.lastmod.slice(0, 10)}</lastmod>`
				: "";
			return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}</url>`;
		})
		.join("");

	return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlTags}</urlset>`;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export const onGet: RequestHandler = async ({
	send,
	headers,
	cacheControl,
}) => {
	headers.set("Content-Type", "application/xml; charset=utf-8");
	cacheControl({ maxAge: 3600, staleWhileRevalidate: 86400 });

	const entries: SitemapEntry[] = [{ loc: env.APP_URL }];

	const publishedPages = await db
		.select({ url: menuItems.url, updatedAt: pages.updatedAt })
		.from(pages)
		.innerJoin(menuItems, eq(menuItems.pageId, pages.id))
		.where(and(eq(pages.status, "published"), eq(menuItems.status, "visible")));
	for (const page of publishedPages) {
		entries.push({
			loc: new URL(page.url, env.APP_URL).toString(),
			lastmod: page.updatedAt,
		});
	}

	let postsCursor: string | null | undefined = null;
	do {
		const result = await postsService.getAll(100, postsCursor, "forward");
		for (const post of result.items) {
			if (post.visibility !== "global") continue;
			entries.push({
				loc: new URL(`/posts/${post.id}`, env.APP_URL).toString(),
				lastmod: post.updatedAt,
			});
		}
		postsCursor = result.nextCursor;
	} while (postsCursor);

	let eventsCursor: string | null | undefined = null;
	do {
		const result = await eventsService.getAll(100, eventsCursor);
		for (const evt of result.items) {
			if (evt.visibility !== "global") continue;
			entries.push({
				loc: new URL(`/events/${evt.id}`, env.APP_URL).toString(),
				lastmod: evt.updatedAt,
			});
		}
		eventsCursor = result.nextCursor;
	} while (eventsCursor);

	const groups = await groupsService.getAll();
	for (const group of groups) {
		entries.push({
			loc: new URL(`/groups/${group.slug}`, env.APP_URL).toString(),
			lastmod: group.updatedAt,
		});
	}

	for (const entry of await sitemapEntriesOf(activeModules)) {
		entries.push({
			loc: new URL(entry.path, env.APP_URL).toString(),
			lastmod: entry.lastmod ?? undefined,
		});
	}

	send(200, toXml(entries));
};

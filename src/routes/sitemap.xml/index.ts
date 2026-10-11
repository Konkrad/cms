import type { RequestHandler } from "@qwik.dev/router";
import { pagesService } from "~/core/content/pages.service";
import { postsService } from "~/core/content/posts.service";
import { activeModules } from "~/core/registry/manifests";
import { sitemapEntriesOf } from "~/core/router/modules";
import { scopeUrl } from "~/core/router/scope-path";
import { scopesService } from "~/core/scopes/scopes.service";
import { env } from "~/env";

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

	const publishedPages = await pagesService.getPublishedUrls();
	for (const page of publishedPages) {
		entries.push({
			loc: new URL(page.url, env.APP_URL).toString(),
			lastmod: page.updatedAt,
		});
	}

	let postsCursor: string | null | undefined = null;
	do {
		const result = await postsService.getAll(null, 100, postsCursor, "forward");
		for (const post of result.items) {
			if (post.visibility !== "public") continue;
			entries.push({
				loc: new URL(`/posts/${post.id}`, env.APP_URL).toString(),
				lastmod: post.updatedAt,
			});
		}
		postsCursor = result.nextCursor;
	} while (postsCursor);

	// Scope home pages (groups, regions, chapters); the root is the home page above.
	const root = await scopesService.getRoot();
	for (const scope of root ? await scopesService.getDescendants(root.id) : []) {
		entries.push({
			loc: new URL(scopeUrl(scope.path), env.APP_URL).toString(),
			lastmod: scope.createdAt,
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

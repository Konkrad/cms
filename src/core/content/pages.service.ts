import crypto from "crypto";
import { and, asc, eq, inArray, like, or } from "drizzle-orm";
import { sanitizeRichHtml } from "~/core/content/sanitize-html";
import type { MenuItem } from "~/core/content/schema/menu-items";
import { menuItems } from "~/core/content/schema/menu-items";
import type { Page } from "~/core/content/schema/pages";
import { pages } from "~/core/content/schema/pages";
import type { BlockData } from "~/core/content/schema/shared";
import { db } from "~/core/db/connection";
import { blocksLinksToRefs } from "~/core/registry/refs";
import type { ModuleDefinition } from "~/core/router/modules";
import { redirectsService } from "~/core/router/redirects.service";
import { pageSlugProblem } from "~/core/router/reserved-slugs";
import { scopeUrl } from "~/core/router/scope-path";
import { scopes } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";

export type PageWithMenuItem = Page & {
	menuItem: Pick<MenuItem, "id" | "title" | "url" | "status"> | null;
};

export class PageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PageError";
	}
}

/** Blocks whose `content` field is rendered as HTML (`dangerouslySetInnerHTML`). */
const HTML_BLOCKS = new Set(["TextBlock"]);

/**
 * Page content is written by scope managers (representatives included) and rendered for
 * everyone, so it is sanitized on write: HTML fields through `sanitizeRichHtml`, and any
 * `javascript:` / `data:` URL value (link and button fields) is dropped.
 */
export function sanitizeBlocks(blocks: BlockData[]): BlockData[] {
	const clean = (value: unknown): unknown => {
		if (typeof value === "string") {
			return /^\s*(javascript:|vbscript:|data:text\/html)/i.test(value)
				? ""
				: value;
		}
		if (Array.isArray(value)) return value.map(clean);
		if (value && typeof value === "object") {
			return Object.fromEntries(
				Object.entries(value).map(([k, v]) => [k, clean(v)]),
			);
		}
		return value;
	};
	return blocks.map((block) => {
		const data = clean(block.data ?? {}) as Record<string, unknown>;
		if (
			HTML_BLOCKS.has(block.componentType) &&
			typeof data.content === "string"
		) {
			data.content = sanitizeRichHtml(data.content);
		}
		return { ...block, data };
	});
}

/** "/about" or "about" → "about"; "/" → "" (the root's home page). */
export function slugFromPath(path: string): string {
	return path.trim().replace(/^\/+|\/+$/g, "");
}

async function withMenuItems(rows: Page[]): Promise<PageWithMenuItem[]> {
	const ids = rows.map((p) => p.id);
	const linked = ids.length
		? await db
				.select({
					id: menuItems.id,
					title: menuItems.title,
					url: menuItems.url,
					status: menuItems.status,
					pageId: menuItems.pageId,
				})
				.from(menuItems)
				.where(inArray(menuItems.pageId, ids))
		: [];
	const byPage = new Map(linked.map((m) => [m.pageId, m]));
	return rows.map((page) => {
		const mi = byPage.get(page.id);
		return {
			...page,
			menuItem: mi
				? { id: mi.id, title: mi.title, url: mi.url, status: mi.status }
				: null,
		};
	});
}

export const pagesService = {
	/** Public URL and last update of every published page (sitemap). */
	async getPublishedUrls(): Promise<Array<{ url: string; updatedAt: string }>> {
		const rows = await db
			.select({
				slug: pages.slug,
				updatedAt: pages.updatedAt,
				scopePath: scopes.path,
			})
			.from(pages)
			.innerJoin(scopes, eq(scopes.id, pages.scopeId))
			.where(eq(pages.status, "published"));
		return rows.map((r) => ({
			url: scopeUrl(r.scopePath, r.slug),
			updatedAt: r.updatedAt,
		}));
	},

	/** The pages a scope owns, by slug, with their menu item (root pages only have one). */
	async listByScope(scopeId: string): Promise<PageWithMenuItem[]> {
		const rows = await db
			.select()
			.from(pages)
			.where(eq(pages.scopeId, scopeId))
			.orderBy(asc(pages.slug));
		return withMenuItems(rows as Page[]);
	},

	async getById(id: string): Promise<PageWithMenuItem | undefined> {
		const rows = await db.select().from(pages).where(eq(pages.id, id));
		if (!rows.length) return undefined;
		return (await withMenuItems(rows as Page[]))[0];
	},

	/** Owning scope and slug of the pages with these ids (reference resolution). */
	async locate(
		ids: readonly string[],
	): Promise<
		Array<{ id: string; scopeId: string; slug: string; title: string }>
	> {
		if (!ids.length) return [];
		return db
			.select({
				id: pages.id,
				scopeId: pages.scopeId,
				slug: pages.slug,
				title: pages.title,
			})
			.from(pages)
			.where(inArray(pages.id, [...ids]));
	},

	/** Published pages whose title or slug contains `query` (admin link picker). */
	async searchPublished(
		query: string,
		limit: number,
	): Promise<
		Array<{ id: string; scopeId: string; slug: string; title: string }>
	> {
		return db
			.select({
				id: pages.id,
				scopeId: pages.scopeId,
				slug: pages.slug,
				title: pages.title,
			})
			.from(pages)
			.where(
				and(
					eq(pages.status, "published"),
					or(like(pages.title, `%${query}%`), like(pages.slug, `%${query}%`)),
				),
			)
			.orderBy(asc(pages.title))
			.limit(limit);
	},

	/** The page of a scope at a slug ("" = the root's home page), published or not. */
	async getBySlug(scopeId: string, slug: string): Promise<Page | undefined> {
		const rows = await db
			.select()
			.from(pages)
			.where(and(eq(pages.scopeId, scopeId), eq(pages.slug, slug)));
		return rows[0] as Page | undefined;
	},

	/**
	 * Why `slug` cannot be used for a page of `scopeId` (null when it can): the URL rules of
	 * `pageSlugProblem` plus another page of the scope with that slug.
	 */
	async slugProblem(
		scopeId: string,
		slug: string,
		modules: readonly ModuleDefinition[],
		exceptPageId?: string,
	): Promise<string | null> {
		const scope = await scopesService.getById(scopeId);
		if (!scope) return "Scope not found";
		const problem = pageSlugProblem(slug, {
			isRoot: scope.parentId === null,
			modules,
			childScopeSlugs: await scopesService.childSlugs(scopeId),
		});
		if (problem) return problem;
		const existing = await this.getBySlug(scopeId, slug);
		if (existing && existing.id !== exceptPageId) {
			return `A page at "${scopeUrl(scope.path, slug)}" already exists`;
		}
		return null;
	},

	/** Create a page in a scope. Throws `PageError` when the slug is not available. */
	async create(
		input: {
			scopeId: string;
			slug: string;
			title: string;
			status?: "draft" | "published";
			content?: BlockData[];
		},
		modules: readonly ModuleDefinition[],
	): Promise<Page> {
		const problem = await this.slugProblem(input.scopeId, input.slug, modules);
		if (problem) throw new PageError(problem);
		const scope = await scopesService.getById(input.scopeId);
		// A page now lives here: an old URL redirected away from it is live again.
		await redirectsService.release(scopeUrl(scope!.path, input.slug));
		const [inserted] = await db
			.insert(pages)
			.values({
				id: crypto.randomUUID(),
				scopeId: input.scopeId,
				slug: input.slug,
				title: input.title,
				content: sanitizeBlocks(await blocksLinksToRefs(input.content ?? [])),
				status: input.status ?? "draft",
			})
			.returning();
		return inserted as Page;
	},

	/**
	 * Update a page's settings or content. A new slug is checked like on create. Returns the page
	 * before and after, so callers can react to a changed URL.
	 */
	async update(
		id: string,
		data: {
			title?: string;
			slug?: string;
			status?: "draft" | "published";
			content?: BlockData[];
		},
		modules: readonly ModuleDefinition[] = [],
	): Promise<{ before: Page; after: Page }> {
		const [before] = (await db
			.select()
			.from(pages)
			.where(eq(pages.id, id))) as Page[];
		if (!before) throw new PageError("Page not found");
		if (data.slug !== undefined && data.slug !== before.slug) {
			const problem = await this.slugProblem(
				before.scopeId,
				data.slug,
				modules,
				id,
			);
			if (problem) throw new PageError(problem);
		}
		const [after] = await db
			.update(pages)
			.set({
				...data,
				...(data.content
					? { content: sanitizeBlocks(await blocksLinksToRefs(data.content)) }
					: {}),
				updatedAt: new Date().toISOString(),
			})
			.where(eq(pages.id, id))
			.returning();
		// A changed URL: the old one (bookmarks, external links) redirects to the new one.
		if (before.slug !== after.slug && before.slug !== "") {
			const scope = await scopesService.getById(before.scopeId);
			await redirectsService.add(
				scopeUrl(scope!.path, before.slug),
				scopeUrl(scope!.path, after.slug),
			);
		}
		return { before, after: after as Page };
	},

	async delete(id: string): Promise<void> {
		await db.delete(pages).where(eq(pages.id, id));
	},
};

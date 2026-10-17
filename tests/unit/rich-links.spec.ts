import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveMenuUrls } from "~/core/content/menu-links";
import { sanitizeRichHtml } from "~/core/content/sanitize-html";
import type { MenuItemTree } from "~/core/content/schema/menu-items";
import {
	collectBlockRefs,
	collectRefHrefs,
	rewriteBlockRefs,
	rewriteRefLinks,
} from "~/core/refs/rich-links";
import {
	blocksLinksToRefs,
	internalLinksToRefs,
	renderBlockRefs,
	renderRichHtml,
} from "~/core/registry/refs";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { createTestUser, openDb } from "./helpers";

describe("rewriteRefLinks (pure)", () => {
	const urls = new Map<string, string | null>([
		["ref:core:article:a", "/germany/articles/a"],
		["ref:core:article:gone", null],
	]);

	it("rewrites resolvable references and drops the others, keeping their text", () => {
		const html =
			'<p>Read <a href="ref:core:article:a">this</a>, <a href="ref:core:article:gone">that <strong>one</strong></a> and <a href="ref:core:article:unknown">x</a>.</p>';
		expect(collectRefHrefs(html)).toEqual([
			"ref:core:article:a",
			"ref:core:article:gone",
			"ref:core:article:unknown",
		]);
		expect(rewriteRefLinks(html, urls)).toBe(
			'<p>Read <a href="/germany/articles/a">this</a>, that <strong>one</strong> and x.</p>',
		);
	});

	it("leaves external links alone", () => {
		const html =
			'<a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">ext</a>';
		expect(rewriteRefLinks(html, urls)).toBe(html);
	});

	it("rewrites link fields and HTML fields in block data", () => {
		const blocks = [
			{ data: { href: "ref:core:article:a", text: "Go" } },
			{ data: { href: "ref:core:article:gone" } },
			{ data: { content: '<p><a href="ref:core:article:a">x</a></p>' } },
			{ data: { href: "https://example.com", tiles: [{ link: "/login" }] } },
		];
		expect(collectBlockRefs(blocks).sort()).toEqual([
			"ref:core:article:a",
			"ref:core:article:gone",
		]);
		expect(rewriteBlockRefs(blocks, urls)).toEqual([
			{ data: { href: "/germany/articles/a", text: "Go" } },
			{ data: { href: "" } },
			{ data: { content: '<p><a href="/germany/articles/a">x</a></p>' } },
			{ data: { href: "https://example.com", tiles: [{ link: "/login" }] } },
		]);
	});
});

describe("stored references (db)", () => {
	const tag = Date.now().toString(36);
	let scope: Scope;
	let articleId: string;
	let cleanupUser: () => void;

	beforeAll(async () => {
		const root = await scopesService.ensureRoot();
		scope = await scopesService.create(
			{ parentId: root.id, kind: "region", slug: `rl-${tag}`, name: "RL" },
			new Set(),
		);
		const user = createTestUser();
		cleanupUser = user.cleanup;
		articleId = crypto.randomUUID();
		const db = openDb();
		db.prepare(
			"INSERT INTO articles (id, title, body, author_id, scope_id, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		).run(
			articleId,
			"Linked",
			"<p>x</p>",
			user.userId,
			scope.id,
			new Date().toISOString(),
			new Date().toISOString(),
		);
		db.close();
	});

	afterAll(async () => {
		const db = openDb();
		db.prepare("DELETE FROM articles WHERE id = ?").run(articleId);
		db.close();
		cleanupUser();
		await scopesService.delete(scope.id);
	});

	it("turns links to site pages into references on write, then sanitizes", async () => {
		const html = `<p><a href="/rl-${tag}/articles/${articleId}">post</a> <a href="http://localhost:5173/rl-${tag}">group</a> <a href="/nowhere">gone</a> <a href="https://example.com">ext</a></p>`;
		const stored = sanitizeRichHtml(await internalLinksToRefs(html));
		expect(stored).toBe(
			`<p><a href="ref:core:article:${articleId}">post</a> <a href="ref:scope:${scope.id}">group</a> <span>gone</span> <a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">ext</a></p>`,
		);
		// Rendering gives the current URLs, and follows a rename.
		expect(await renderRichHtml(stored)).toContain(
			`<a href="/rl-${tag}/articles/${articleId}">post</a>`,
		);
		await scopesService.changeSlug(scope.id, `rl2-${tag}`, new Set());
		try {
			const rendered = await renderRichHtml(stored);
			expect(rendered).toContain(
				`<a href="/rl2-${tag}/articles/${articleId}">post</a>`,
			);
			expect(rendered).toContain(`<a href="/rl2-${tag}">group</a>`);
		} finally {
			await scopesService.changeSlug(scope.id, `rl-${tag}`, new Set());
		}
	});

	it("keeps editor links in an article's and a note's body (the editor's HTML is stored)", async () => {
		const { articlesService } = await import("~/core/content/articles.service");
		const { notesService } = await import("~/core/content/notes.service");
		const user = createTestUser();
		const body = `<p>See <a href="ref:scope:${scope.id}"><strong>the group</strong></a> &lt;now&gt;</p>`;
		const article = await articlesService.create({
			title: "Editor links",
			body,
			authorId: user.userId,
			scopeId: scope.id,
			visibility: "members",
		});
		const note = await notesService.create({
			body,
			authorId: user.userId,
			scopeId: scope.id,
			visibility: "members",
		});
		try {
			expect(article.body).toBe(body);
			expect(note.body).toBe(body);
		} finally {
			const db = openDb();
			db.prepare("DELETE FROM articles WHERE id = ?").run(article.id);
			db.prepare("DELETE FROM notes WHERE id = ?").run(note.id);
			db.close();
			user.cleanup();
		}
	});

	it("turns link fields of blocks into references and renders them", async () => {
		const [block] = await blocksLinksToRefs([
			{
				id: "b",
				componentType: "ActionButtonBlock",
				order: 0,
				data: { href: `/rl-${tag}`, text: `/rl-${tag}` },
			},
		]);
		// Only link fields (href, link) are converted, never plain text.
		expect(block.data).toEqual({
			href: `ref:scope:${scope.id}`,
			text: `/rl-${tag}`,
		});
		expect(await renderBlockRefs([block])).toEqual([
			{ ...block, data: { href: `/rl-${tag}`, text: `/rl-${tag}` } },
		]);
	});

	it("resolves menu items and leaves out those whose target is gone", async () => {
		const item = (id: string, url: string, children: MenuItemTree[] = []) =>
			({ id, url, children }) as unknown as MenuItemTree;
		const menu = await resolveMenuUrls([
			item("a", `ref:scope:${scope.id}`, [
				item("a1", `ref:core:article:${crypto.randomUUID()}`),
				item("a2", "/login"),
			]),
			item("b", `ref:core:page:${crypto.randomUUID()}`, [item("b1", "/x")]),
			item("c", "https://example.com"),
		]);
		expect(
			menu.map((m) => [m.id, m.url, (m.children ?? []).map((c) => c.url)]),
		).toEqual([
			["a", `/rl-${tag}`, ["/login"]],
			["c", "https://example.com", []],
		]);
	});
});

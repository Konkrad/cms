import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { scopesService } from "~/services/scopes.service";
import {
	currentScopePath,
	getScopePaths,
	isScopeablePath,
	SCOPE_PATH_KEY,
} from "~/utils/scope-request";
import { openDb } from "./helpers";

const createdIds: string[] = [];

afterEach(() => {
	const db = openDb();
	for (const id of createdIds.splice(0).reverse())
		db.prepare("DELETE FROM scopes WHERE id = ?").run(id);
	db.close();
});

describe("isScopeablePath", () => {
	it.each([
		"/",
		"/events",
		"/germany/berlin/events/bbq",
		"/apix",
	])("matches %s", (p) => {
		expect(isScopeablePath(p)).toBe(true);
	});
	it.each([
		"/api/images",
		"/build/q-abc.js",
		"/assets/logo.svg",
		"/@vite/client",
		"/@fs/x",
	])("skips %s", (p) => {
		expect(isScopeablePath(p)).toBe(false);
	});
});

describe("currentScopePath", () => {
	it("defaults to root when the middleware set nothing", () => {
		expect(currentScopePath({ sharedMap: new Map() })).toBe("/");
	});
	it("returns the matched scope path", () => {
		const sharedMap = new Map([[SCOPE_PATH_KEY, "/germany/"]]);
		expect(currentScopePath({ sharedMap })).toBe("/germany/");
	});
});

describe("getScopePaths cache", () => {
	it("sees scopes created through scopesService immediately", async () => {
		const root = await scopesService.ensureRoot();
		await getScopePaths();
		const slug = `u${crypto.randomUUID().slice(0, 8)}`;
		const created = await scopesService.create(
			{ parentId: root.id, kind: "region", slug, name: slug },
			new Set(),
		);
		createdIds.push(created.id);
		expect((await getScopePaths()).has(`/${slug}/`)).toBe(true);

		await scopesService.delete(created.id);
		createdIds.pop();
		expect((await getScopePaths()).has(`/${slug}/`)).toBe(false);
	});

	it("sees scopes written by another connection", async () => {
		const root = await scopesService.ensureRoot();
		await getScopePaths();
		const id = crypto.randomUUID();
		const slug = `x${id.slice(0, 8)}`;
		const db = openDb();
		db.prepare(
			"INSERT INTO scopes (id, parent_id, kind, slug, name, path) VALUES (?, ?, 'region', ?, ?, ?)",
		).run(id, root.id, slug, slug, `/${slug}/`);
		db.close();
		createdIds.push(id);
		expect((await getScopePaths()).has(`/${slug}/`)).toBe(true);
	});
});

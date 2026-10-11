import { describe, expect, it } from "vitest";
import { canonicalRedirect } from "~/core/refs/canonical";
import {
	fillRefPath,
	formatHumanRef,
	formatRef,
	isRefHref,
	itemRef,
	parseHumanRef,
	parseRef,
	refHref,
	scopeRef,
} from "~/core/refs/refs";

const ID = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

describe("parseRef / formatRef", () => {
	it.each([
		`scope:${ID}`,
		`scope:${ID}/events`,
		`events:event:${ID}`,
		`core:note:${ID}`,
		`core:article:${ID}`,
		`core:page:${ID}`,
	])("round trips %s", (ref) => {
		const parsed = parseRef(ref);
		expect(parsed).not.toBeNull();
		expect(formatRef(parsed!)).toBe(ref);
		// The `ref:` form stored in link fields and hrefs parses the same.
		expect(parseRef(refHref(ref))).toEqual(parsed);
	});

	it("parses the parts", () => {
		expect(parseRef(`ref:events:event:${ID}`)).toEqual({
			kind: "item",
			module: "events",
			type: "event",
			id: ID,
		});
		expect(parseRef(`scope:${ID}/jobs`)).toEqual({
			kind: "scope",
			scopeId: ID,
			module: "jobs",
		});
	});

	it.each([
		"",
		"ref:",
		"scope:",
		"scope:a/b/c",
		`scope:${ID}/Events`,
		"events:event",
		"events:event:x:y",
		"Events:event:1",
		"events:event:bad id",
		"javascript:alert(1)",
		"/germany/berlin",
		"https://example.com",
	])("rejects %j", (value) => {
		expect(parseRef(value)).toBeNull();
	});

	it("builds refs and hrefs", () => {
		expect(itemRef("jobs", "job", ID)).toBe(`jobs:job:${ID}`);
		expect(scopeRef(ID)).toBe(`scope:${ID}`);
		expect(scopeRef(ID, "events")).toBe(`scope:${ID}/events`);
		expect(refHref(`core:note:${ID}`)).toBe(`ref:core:note:${ID}`);
		expect(refHref(`ref:core:note:${ID}`)).toBe(`ref:core:note:${ID}`);
		expect(isRefHref(` ref:scope:${ID}`)).toBe(true);
		expect(isRefHref("/scope")).toBe(false);
		expect(isRefHref(null)).toBe(false);
	});
});

describe("human-readable form", () => {
	it("parses scope paths and module listings", () => {
		expect(parseHumanRef("root/germany/berlin:events")).toEqual({
			scopePath: "/germany/berlin/",
			module: "events",
		});
		expect(parseHumanRef("root/germany")).toEqual({
			scopePath: "/germany/",
		});
		expect(parseHumanRef("root")).toEqual({ scopePath: "/" });
		expect(parseHumanRef("root:jobs")).toEqual({
			scopePath: "/",
			module: "jobs",
		});
	});

	it.each([
		"",
		"germany/berlin",
		"/root/germany",
		"root/Germany",
		"root/germany/",
		"root/germany:events:x",
		"root/ger many",
	])("rejects %j", (value) => {
		expect(parseHumanRef(value)).toBeNull();
	});

	it("formats the inverse", () => {
		expect(formatHumanRef("/germany/berlin/", "events")).toBe(
			"root/germany/berlin:events",
		);
		expect(formatHumanRef("/")).toBe("root");
		for (const human of ["root", "root/a/b", "root/a:jobs"]) {
			const parsed = parseHumanRef(human)!;
			expect(formatHumanRef(parsed.scopePath, parsed.module)).toBe(human);
		}
	});
});

describe("fillRefPath", () => {
	it("fills slugs and ids", () => {
		expect(fillRefPath("/events/:slug", { id: ID, slug: "bbq" })).toBe(
			"/events/bbq",
		);
		expect(fillRefPath("/jobs/:id", { id: ID })).toBe(`/jobs/${ID}`);
		// No slug: the id stands in. The empty slug (root home page) stays empty.
		expect(fillRefPath("/events/:slug", { id: ID, slug: null })).toBe(
			`/events/${ID}`,
		);
		expect(fillRefPath("/:slug", { id: ID, slug: "" })).toBe("/");
	});
});

describe("canonicalRedirect", () => {
	it("redirects only when the path differs from the canonical URL", () => {
		expect(canonicalRedirect("/events/bbq", "/germany/events/bbq")).toBe(
			"/germany/events/bbq",
		);
		expect(
			canonicalRedirect("/germany/events/bbq", "/germany/events/bbq"),
		).toBe(null);
		// A trailing slash or percent-encoding is the same URL.
		expect(
			canonicalRedirect("/germany/events/bbq/", "/germany/events/bbq"),
		).toBe(null);
		expect(canonicalRedirect("/events/b%C3%BC", "/events/bü")).toBeNull();
		expect(
			canonicalRedirect("/a/events/x/checkout", "/events/x/checkout"),
		).toBe("/events/x/checkout");
	});
});

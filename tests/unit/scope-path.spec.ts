import { describe, expect, it } from "vitest";
import {
	childPath,
	isAncestorPath,
	SCOPE_SLUG_RE,
	scopeUrl,
	splitScopePath,
} from "~/utils/scope-path";

const paths = new Set(["/", "/germany/", "/germany/berlin/"]);

describe("SCOPE_SLUG_RE", () => {
	it.each([
		"germany",
		"a",
		"berlin-mitte",
		"x1",
		"a".repeat(63),
	])("accepts %s", (s) => {
		expect(SCOPE_SLUG_RE.test(s)).toBe(true);
	});
	it.each([
		"",
		"-a",
		"a-",
		"Germany",
		"a_b",
		"a/b",
		"a b",
		"a".repeat(64),
		"ä",
	])("rejects %j", (s) => {
		expect(SCOPE_SLUG_RE.test(s)).toBe(false);
	});
});

describe("childPath", () => {
	it("builds paths with leading and trailing slash", () => {
		expect(childPath("/", "germany")).toBe("/germany/");
		expect(childPath("/germany/", "berlin")).toBe("/germany/berlin/");
	});
});

describe("splitScopePath", () => {
	it("picks the longest matching scope", () => {
		expect(splitScopePath("/germany/berlin/events/bbq", paths)).toEqual({
			scopePath: "/germany/berlin/",
			rest: "/events/bbq",
		});
	});
	it("handles a scope path without trailing slash", () => {
		expect(splitScopePath("/germany/berlin", paths)).toEqual({
			scopePath: "/germany/berlin/",
			rest: "/",
		});
		expect(splitScopePath("/germany/berlin/", paths)).toEqual({
			scopePath: "/germany/berlin/",
			rest: "/",
		});
	});
	it("falls back to root", () => {
		expect(splitScopePath("/events", paths)).toEqual({
			scopePath: "/",
			rest: "/events",
		});
		expect(splitScopePath("/", paths)).toEqual({ scopePath: "/", rest: "/" });
	});
	it("matches whole segments only", () => {
		expect(splitScopePath("/germanyx/events", paths)).toEqual({
			scopePath: "/",
			rest: "/germanyx/events",
		});
	});
	it("stops at the deepest known scope", () => {
		expect(splitScopePath("/germany/hamburg/events", paths)).toEqual({
			scopePath: "/germany/",
			rest: "/hamburg/events",
		});
	});
	it("handles double slashes, trailing slashes and empty input", () => {
		expect(splitScopePath("//germany//berlin//events/", paths)).toEqual({
			scopePath: "/germany/berlin/",
			rest: "/events",
		});
		expect(splitScopePath("", paths)).toEqual({ scopePath: "/", rest: "/" });
		expect(splitScopePath("//", paths)).toEqual({ scopePath: "/", rest: "/" });
	});
});

describe("scopeUrl", () => {
	it("joins scope path and sub path", () => {
		expect(scopeUrl("/germany/berlin/", "/events")).toBe(
			"/germany/berlin/events",
		);
		expect(scopeUrl("/", "/events")).toBe("/events");
		expect(scopeUrl("/germany/")).toBe("/germany");
		expect(scopeUrl("/")).toBe("/");
		expect(scopeUrl("/germany/", "events")).toBe("/germany/events");
	});
});

describe("isAncestorPath", () => {
	it("is true for self and ancestors only", () => {
		expect(isAncestorPath("/", "/germany/")).toBe(true);
		expect(isAncestorPath("/germany/", "/germany/berlin/")).toBe(true);
		expect(isAncestorPath("/germany/", "/germany/")).toBe(true);
		expect(isAncestorPath("/germany/berlin/", "/germany/")).toBe(false);
		expect(isAncestorPath("/germany/", "/germanyx/")).toBe(false);
	});
});

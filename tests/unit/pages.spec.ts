import { describe, expect, it } from "vitest";
import { matchPage, matchPath } from "~/core/pages";
import { toPublicJob } from "~modules/jobs/public-job";

describe("matchPath", () => {
	it("matches static paths", () => {
		expect(matchPath("/jobs", "/jobs")).toEqual({});
		expect(matchPath("/jobs/new", "/jobs/new")).toEqual({});
		expect(matchPath("/", "/")).toEqual({});
	});
	it("ignores trailing slashes and case of static segments", () => {
		expect(matchPath("/jobs", "/jobs/")).toEqual({});
		expect(matchPath("/jobs", "/Jobs")).toEqual({});
	});
	it("extracts and decodes :params", () => {
		expect(matchPath("/jobs/:id", "/jobs/abc")).toEqual({ id: "abc" });
		expect(matchPath("/jobs/mine/:id/edit", "/jobs/mine/a%20b/edit")).toEqual({
			id: "a b",
		});
	});
	it("rejects different lengths or static mismatches", () => {
		expect(matchPath("/jobs/:id", "/jobs")).toBeNull();
		expect(matchPath("/jobs/:id", "/jobs/a/b")).toBeNull();
		expect(matchPath("/jobs/mine/:id/edit", "/jobs/mine/a/view")).toBeNull();
		expect(matchPath("/jobs", "/posts")).toBeNull();
	});
});

describe("matchPage", () => {
	const pages = [
		{ id: "list", path: "/jobs" },
		{ id: "new", path: "/jobs/new" },
		{ id: "detail", path: "/jobs/:id" },
	];
	it("returns the first match in declared order", () => {
		expect(matchPage(pages, "/jobs/new")?.page.id).toBe("new");
		expect(matchPage(pages, "/jobs/42")).toEqual({
			page: pages[2],
			params: { id: "42" },
		});
	});
	it("returns null when nothing matches", () => {
		expect(matchPage(pages, "/about")).toBeNull();
		expect(matchPage(pages, "/")).toBeNull();
	});
});

describe("toPublicJob", () => {
	it("keeps only public author fields", () => {
		const job = {
			id: "j1",
			title: "T",
			user: {
				id: "u1",
				name: "Ada",
				familyName: "L",
				email: "ada@example.com",
				loginId: "l1",
				consent: { x: 1 },
				profilePicture: "private/profile-pictures/a.jpg",
			},
		};
		const result = toPublicJob(
			job as unknown as Parameters<typeof toPublicJob>[0],
		);
		expect(result.user).toEqual({ id: "u1", name: "Ada", familyName: "L" });
		expect(result).toMatchObject({ id: "j1", title: "T" });
	});
	it("handles a missing author", () => {
		const job = { id: "j1", user: null };
		expect(
			toPublicJob(job as unknown as Parameters<typeof toPublicJob>[0]).user,
		).toBeNull();
	});
});

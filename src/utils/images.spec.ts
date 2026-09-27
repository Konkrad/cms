import { describe, expect, it } from "vitest";
import { deriveThumbnailKey, publicImageUrlFromKey } from "./images";

describe("deriveThumbnailKey", () => {
	it("appends -thumb before .webp extension", () => {
		expect(deriveThumbnailKey("public/events/abc.webp")).toBe(
			"public/events/abc-thumb.webp",
		);
	});

	it("works with nested paths", () => {
		expect(deriveThumbnailKey("private/events/123/photos/uuid-here.webp")).toBe(
			"private/events/123/photos/uuid-here-thumb.webp",
		);
	});

	it("works with profile picture keys", () => {
		expect(deriveThumbnailKey("public/profile-pictures/5113fa42.webp")).toBe(
			"public/profile-pictures/5113fa42-thumb.webp",
		);
	});

	it("does not modify non-webp extensions", () => {
		expect(deriveThumbnailKey("public/events/abc.png")).toBe(
			"public/events/abc.png",
		);
	});

	it("only replaces the trailing .webp", () => {
		expect(deriveThumbnailKey("public/events/file.webp.webp")).toBe(
			"public/events/file.webp-thumb.webp",
		);
	});

	it("handles keys without leading slash", () => {
		const key = "public/groups/img.webp";
		expect(deriveThumbnailKey(key)).toBe("public/groups/img-thumb.webp");
		expect(deriveThumbnailKey(key)).not.toContain("//");
	});
});

describe("publicImageUrlFromKey", () => {
	const base = "https://cdn.example.com";

	it("builds a direct S3 URL for a stored key", () => {
		expect(publicImageUrlFromKey("public/events/seed-1.webp", base)).toBe(
			"https://cdn.example.com/public/events/seed-1.webp",
		);
	});

	it("strips a leading slash from the key to avoid a double slash", () => {
		expect(publicImageUrlFromKey("/public/events/seed-1.webp", base)).toBe(
			"https://cdn.example.com/public/events/seed-1.webp",
		);
	});

	it("trims a trailing slash on the base", () => {
		expect(
			publicImageUrlFromKey(
				"public/events/seed-1.webp",
				"https://cdn.example.com/",
			),
		).toBe("https://cdn.example.com/public/events/seed-1.webp");
	});

	it("passes through absolute and inline URLs unchanged", () => {
		expect(publicImageUrlFromKey("http://example.com/a.webp", base)).toBe(
			"http://example.com/a.webp",
		);
		expect(publicImageUrlFromKey("https://example.com/a.webp", base)).toBe(
			"https://example.com/a.webp",
		);
		expect(publicImageUrlFromKey("blob:abc123", base)).toBe("blob:abc123");
		expect(publicImageUrlFromKey("data:image/webp;base64,xxx", base)).toBe(
			"data:image/webp;base64,xxx",
		);
	});

	it("returns null for empty values", () => {
		expect(publicImageUrlFromKey(null, base)).toBeNull();
		expect(publicImageUrlFromKey(undefined, base)).toBeNull();
	});
});

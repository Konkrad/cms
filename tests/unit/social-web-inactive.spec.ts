import { beforeAll, describe, expect, it, vi } from "vitest";
import { fakeRequestEvent } from "./request-event";

// The social-web module switched off: every endpoint answers 404 (spec 4.1), and it announces
// no feed.
vi.mock("../../modules.config", () => ({
	default: {
		active: ["deals", "elections", "events", "jobs", "qualifications"],
	},
}));

const APP = "http://localhost:5173";

// The first import loads the whole registry (slow when cold).
beforeAll(async () => {
	await import("~/core/registry/manifests");
}, 60_000);

describe("social-web inactive", () => {
	it("answers 404 for the feed", async () => {
		const { handleFeedGet } = await import("~/modules/social-web/feed");
		const { event, sent } = fakeRequestEvent(`${APP}/feed.xml`);
		await expect(handleFeedGet(event)).rejects.toMatchObject({ status: 404 });
		expect(sent()).toBeNull();
	});

	it("announces no feed", async () => {
		const { activeFeeds } = await import("~/core/registry/manifests");
		expect(activeFeeds).toEqual([]);
	});
});

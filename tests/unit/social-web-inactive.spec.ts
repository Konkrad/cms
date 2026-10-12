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

	it("answers 404 for WebFinger, the actor, the inbox (any method), the outbox, objects and activities", async () => {
		const actor = await import("~/modules/social-web/actor");
		const outbox = await import("~/modules/social-web/outbox");
		const cases = [
			[
				actor.handleWebfingerGet,
				"/api/well-known/webfinger?resource=acct:news@localhost:5173",
				"GET",
			],
			[actor.handleActorGet, "/social/actor", "GET"],
			[actor.handleInboxRequest, "/social/inbox", "GET"],
			[actor.handleInboxRequest, "/social/inbox", "POST"],
			[outbox.handleOutboxGet, "/social/outbox", "GET"],
			[outbox.handleObjectGet, "/social/objects/note/x", "GET"],
			[outbox.handleActivityGet, "/social/activities/create/note/x", "GET"],
		] as const;
		for (const [handler, path, method] of cases) {
			const { event, sent } = fakeRequestEvent(`${APP}${path}`, {
				method,
				params: { verb: "create", type: "note", id: "x" },
			});
			await expect(handler(event), `${method} ${path}`).rejects.toMatchObject({
				status: 404,
			});
			expect(sent()).toBeNull();
		}
	});

	it("announces no feed", async () => {
		const { activeFeeds } = await import("~/core/registry/manifests");
		expect(activeFeeds).toEqual([]);
	});
});

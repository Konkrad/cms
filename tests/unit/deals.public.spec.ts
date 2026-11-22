import { describe, expect, it } from "vitest";
import { toDealListItem, toPublicDeal } from "~/modules/deals/public-deal";
import type { Deal } from "~/modules/deals/schema";

const deal: Deal = {
	id: "d1",
	name: "Deal",
	description: "desc",
	logo: "public/deals/logos/x.svg",
	validUntil: null,
	scopeId: "root",
	visibility: "public",
	requiredMembershipTier: null,
	steps: [
		{ type: "text", title: "Open", text: "public text" },
		{
			type: "promo",
			title: "Code",
			text: "secret text",
			promoCode: "SECRET",
			requiresLogin: true,
		},
		{
			type: "link",
			title: "Go",
			text: "t",
			link: "https://example.com",
			requiresLogin: true,
		},
	],
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

describe("toPublicDeal", () => {
	it("strips login-gated step content for guests", () => {
		const json = JSON.stringify(toPublicDeal(deal, false, true));
		expect(json).not.toContain("SECRET");
		expect(json).not.toContain("secret text");
		expect(json).not.toContain("example.com");
		expect(json).toContain("public text");
		expect(json).toContain("Code");
	});

	it("keeps everything for logged-in users", () => {
		const json = JSON.stringify(toPublicDeal(deal, true, true));
		expect(json).toContain("SECRET");
		expect(json).toContain("example.com");
	});
});

describe("toPublicDeal with a required membership tier", () => {
	const tierDeal: Deal = { ...deal, requiredMembershipTier: "full" };

	it("keeps no step at all for a viewer without the tier, logged in or not", () => {
		for (const isLoggedIn of [false, true]) {
			const view = toPublicDeal(tierDeal, isLoggedIn, false);
			expect(view.steps).toEqual([]);
			expect(view.tierLocked).toBe(true);
			expect(view.requiredTier).toBe("full");
			const json = JSON.stringify(view);
			expect(json).not.toContain("public text");
			expect(json).not.toContain("SECRET");
		}
		// The deal itself stays visible.
		expect(toPublicDeal(tierDeal, true, false).name).toBe("Deal");
	});

	it("shows the steps to a viewer with the tier", () => {
		const view = toPublicDeal(tierDeal, true, true);
		expect(view.tierLocked).toBe(false);
		expect(JSON.stringify(view)).toContain("SECRET");
	});
});

describe("toDealListItem", () => {
	it("omits steps", () => {
		expect(Object.keys(toDealListItem(deal)).sort()).toEqual([
			"description",
			"id",
			"logo",
			"name",
		]);
	});
});

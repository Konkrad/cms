import { describe, expect, it } from "vitest";
import { toDealListItem, toPublicDeal } from "~modules/deals/public-deal";
import type { Deal } from "~modules/deals/schema";

const deal: Deal = {
	id: "d1",
	name: "Deal",
	description: "desc",
	logo: "public/deals/logos/x.svg",
	validUntil: null,
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
		const json = JSON.stringify(toPublicDeal(deal, false));
		expect(json).not.toContain("SECRET");
		expect(json).not.toContain("secret text");
		expect(json).not.toContain("example.com");
		expect(json).toContain("public text");
		expect(json).toContain("Code");
	});

	it("keeps everything for logged-in users", () => {
		const json = JSON.stringify(toPublicDeal(deal, true));
		expect(json).toContain("SECRET");
		expect(json).toContain("example.com");
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

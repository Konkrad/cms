import { afterEach, describe, expect, it } from "vitest";
import { dealsService } from "~/modules/deals/service";
import { ensureRootScope, openDb } from "./helpers";

const cleanupDealIds: string[] = [];

afterEach(() => {
	const db = openDb();
	for (const id of cleanupDealIds.splice(0)) {
		db.prepare("DELETE FROM deals WHERE id = ?").run(id);
	}
	db.close();
});

async function makeDeal(overrides: Record<string, unknown> = {}) {
	const deal = await dealsService.create({
		name: "Test Deal",
		description: "A deal",
		steps: [{ type: "promo", title: "Code", text: "Use it", promoCode: "X1" }],
		scopeId: ensureRootScope(),
		...overrides,
	} as any);
	cleanupDealIds.push(deal.id);
	return deal;
}

const inDays = (days: number) =>
	new Date(Date.now() + days * 86400000).toISOString();

describe("dealsService.create", () => {
	it("creates a deal with an id, steps and no expiry by default", async () => {
		const deal = await makeDeal();
		expect(deal.id).toBeTruthy();
		expect(deal.name).toBe("Test Deal");
		expect(deal.validUntil).toBeNull();
		expect(deal.steps).toHaveLength(1);
		expect(deal.steps[0].promoCode).toBe("X1");
	});

	it("keeps an explicit null validUntil as null (not epoch)", async () => {
		const deal = await makeDeal({ validUntil: null });
		expect(deal.validUntil).toBeNull();
	});

	it("defaults steps to an empty list", async () => {
		const deal = await makeDeal({ steps: undefined });
		expect(deal.steps).toEqual([]);
	});

	it("rejects a step without a title", async () => {
		await expect(
			dealsService.create({
				name: "Bad",
				steps: [{ type: "text", title: "", text: "x" }],
			} as any),
		).rejects.toThrow();
	});
});

describe("dealsService.getById", () => {
	it("returns the deal", async () => {
		const deal = await makeDeal();
		const fetched = await dealsService.getById(deal.id);
		expect(fetched?.id).toBe(deal.id);
	});

	it("returns undefined for a non-existent id", async () => {
		expect(await dealsService.getById(crypto.randomUUID())).toBeUndefined();
	});
});

describe("dealsService.getAll / getActive", () => {
	it("getAll includes expired deals, getActive does not", async () => {
		const open = await makeDeal({ name: "No expiry" });
		const future = await makeDeal({ name: "Future", validUntil: inDays(5) });
		const expired = await makeDeal({ name: "Expired", validUntil: inDays(-5) });

		const allIds = (await dealsService.getAll()).map((d) => d.id);
		expect(allIds).toEqual(
			expect.arrayContaining([open.id, future.id, expired.id]),
		);

		const activeIds = (await dealsService.getActive()).map((d) => d.id);
		expect(activeIds).toContain(open.id);
		expect(activeIds).toContain(future.id);
		expect(activeIds).not.toContain(expired.id);
	});
});

describe("dealsService.update", () => {
	it("updates fields and bumps updatedAt", async () => {
		const deal = await makeDeal();
		await new Promise((r) => setTimeout(r, 5));
		const updated = await dealsService.update(deal.id, {
			name: "Renamed",
			validUntil: inDays(3),
			steps: [],
		} as any);
		expect(updated.name).toBe("Renamed");
		expect(updated.validUntil).toBeTruthy();
		expect(updated.steps).toEqual([]);
		expect(updated.updatedAt >= deal.updatedAt).toBe(true);
	});

	it("clears validUntil with null", async () => {
		const deal = await makeDeal({ validUntil: inDays(3) });
		const updated = await dealsService.update(deal.id, {
			validUntil: null,
		} as any);
		expect(updated.validUntil).toBeNull();
	});
});

describe("dealsService.delete", () => {
	it("removes the deal", async () => {
		const deal = await makeDeal();
		await dealsService.delete(deal.id);
		expect(await dealsService.getById(deal.id)).toBeUndefined();
	});
});

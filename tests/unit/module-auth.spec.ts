import { describe, expect, it, vi } from "vitest";

const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }));
vi.mock("~/core/auth/server-auth", () => ({ requireAuth }));

import { requireModuleAuth } from "~/core/module-auth";

const event = {
	error: (status: number) => ({ error: { status } }),
} as unknown as Parameters<typeof requireModuleAuth>[0];

describe("requireModuleAuth", () => {
	it("returns the user for an active module", async () => {
		requireAuth.mockResolvedValueOnce({ id: "u1" });
		expect(await requireModuleAuth(event, "jobs")).toEqual({ id: "u1" });
	});

	it("404s for an inactive module", async () => {
		requireAuth.mockResolvedValueOnce({ id: "u1" });
		await expect(requireModuleAuth(event, "nope")).rejects.toEqual({
			error: { status: 404 },
		});
	});

	it("lets the login redirect through before the module check", async () => {
		requireAuth.mockRejectedValueOnce({ redirect: "/login" });
		await expect(requireModuleAuth(event, "nope")).rejects.toEqual({
			redirect: "/login",
		});
	});
});

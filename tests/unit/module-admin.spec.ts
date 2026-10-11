import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireScopeRole } = vi.hoisted(() => ({
	requireScopeRole: vi.fn(),
}));
vi.mock("~/core/scopes/access", () => ({
	ADMIN_ACCESS: "representative",
	requireScopeRole,
}));

import { requireModuleAdmin } from "~/core/registry/module-admin";
import { toPublicUser } from "~/core/users/public-user";

/** Event whose redirect/error helpers throw a tagged object, like Qwik's. */
const makeEvent = () =>
	({
		redirect: (status: number, url: string) => ({ redirect: { status, url } }),
		error: (status: number, message: string) => ({
			error: { status, message },
		}),
	}) as unknown as Parameters<typeof requireModuleAdmin>[0];

const rootAccess = {
	user: { id: "u1" },
	scope: { id: "root", parentId: null, path: "/" },
	ancestors: [],
};
const chapterAccess = {
	user: { id: "u2" },
	scope: { id: "c1", parentId: "r1", path: "/region/chapter/" },
	ancestors: [],
};

describe("requireModuleAdmin", () => {
	beforeEach(() => requireScopeRole.mockReset());

	it("asks for a managing role on the URL's scope", async () => {
		requireScopeRole.mockResolvedValueOnce(rootAccess);
		await requireModuleAdmin(makeEvent(), { module: "events", scope: "any" });
		expect(requireScopeRole).toHaveBeenCalledWith(
			expect.anything(),
			"representative",
		);
	});

	it("scope any: returns the access for the root and for other scopes", async () => {
		requireScopeRole.mockResolvedValueOnce(rootAccess);
		expect(
			await requireModuleAdmin(makeEvent(), { module: "events", scope: "any" }),
		).toEqual({ ...rootAccess, isRoot: true, adminBase: "/admin/root" });
		requireScopeRole.mockResolvedValueOnce(chapterAccess);
		expect(
			await requireModuleAdmin(makeEvent(), { module: "events", scope: "any" }),
		).toEqual({
			...chapterAccess,
			isRoot: false,
			adminBase: "/admin/region.chapter",
		});
	});

	it("scope global: returns the access on the root", async () => {
		requireScopeRole.mockResolvedValueOnce(rootAccess);
		expect(
			await requireModuleAdmin(makeEvent(), {
				module: "jobs",
				scope: "global",
			}),
		).toMatchObject({ isRoot: true });
	});

	it("scope global: 404s on any other scope", async () => {
		requireScopeRole.mockResolvedValueOnce(chapterAccess);
		await expect(
			requireModuleAdmin(makeEvent(), { module: "deals", scope: "global" }),
		).rejects.toMatchObject({ error: { status: 404 } });
	});

	it("404s for an inactive module in either scope", async () => {
		requireScopeRole.mockResolvedValue(rootAccess);
		for (const scope of ["global", "any"] as const) {
			await expect(
				requireModuleAdmin(makeEvent(), { module: "nope", scope }),
			).rejects.toMatchObject({ error: { status: 404 } });
		}
	});

	it("propagates the auth helper's redirect and checks auth before the module", async () => {
		requireScopeRole.mockRejectedValueOnce({
			redirect: { status: 302, url: "/login" },
		});
		await expect(
			requireModuleAdmin(makeEvent(), { module: "nope", scope: "any" }),
		).rejects.toEqual({ redirect: { status: 302, url: "/login" } });
	});
});

describe("toPublicUser", () => {
	it("returns only id, name and familyName", () => {
		const row = {
			id: "u1",
			name: "Ada",
			familyName: "Lovelace",
			email: "ada@example.com",
			loginId: "ada-login",
			city: "London",
			country: "UK",
			yearOfBirth: 1815,
			consent: { photos: true },
			profilePicture: "private/profile-pictures/x.png",
		};
		const result = toPublicUser(row as never);
		expect(result).toEqual({
			id: "u1",
			name: "Ada",
			familyName: "Lovelace",
		});
		expect(Object.keys(result).sort()).toEqual(["familyName", "id", "name"]);
		expect(JSON.stringify(result)).not.toMatch(
			/ada@|ada-login|London|1815|admin|consent|private/,
		);
	});

	it("does not mutate its input", () => {
		const row = { id: "u1", name: "A", familyName: "B", email: "a@b.c" };
		toPublicUser(row);
		expect(row.email).toBe("a@b.c");
	});
});

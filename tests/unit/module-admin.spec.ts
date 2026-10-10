import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireGroupAdmin } = vi.hoisted(() => ({
	requireGroupAdmin: vi.fn(),
}));
vi.mock("~/core/scopes/access-control", () => ({ requireGroupAdmin }));

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

const globalCtx = { user: { id: "u1" }, isGlobal: true, group: null };
const groupCtx = { user: { id: "u2" }, isGlobal: false, group: { id: "g1" } };

describe("requireModuleAdmin", () => {
	beforeEach(() => requireGroupAdmin.mockReset());

	it("scope any: returns the context for global and group scopes", async () => {
		requireGroupAdmin.mockResolvedValueOnce(globalCtx);
		expect(
			await requireModuleAdmin(makeEvent(), { module: "events", scope: "any" }),
		).toBe(globalCtx);
		requireGroupAdmin.mockResolvedValueOnce(groupCtx);
		expect(
			await requireModuleAdmin(makeEvent(), { module: "events", scope: "any" }),
		).toBe(groupCtx);
	});

	it("scope global: returns the context for the global scope", async () => {
		requireGroupAdmin.mockResolvedValueOnce(globalCtx);
		expect(
			await requireModuleAdmin(makeEvent(), {
				module: "jobs",
				scope: "global",
			}),
		).toBe(globalCtx);
	});

	it("scope global: redirects a non-global slug to /admin/global/<module>", async () => {
		requireGroupAdmin.mockResolvedValueOnce(groupCtx);
		await expect(
			requireModuleAdmin(makeEvent(), { module: "deals", scope: "global" }),
		).rejects.toEqual({
			redirect: { status: 302, url: "/admin/global/deals" },
		});
	});

	it("404s for an inactive module in either scope", async () => {
		requireGroupAdmin.mockResolvedValue(globalCtx);
		for (const scope of ["global", "any"] as const) {
			await expect(
				requireModuleAdmin(makeEvent(), { module: "nope", scope }),
			).rejects.toMatchObject({ error: { status: 404 } });
		}
	});

	it("propagates the auth helper's redirect and checks auth before the module", async () => {
		requireGroupAdmin.mockRejectedValueOnce({
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
			role: "admin",
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

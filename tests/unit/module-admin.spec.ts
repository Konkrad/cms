import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireScopeRole } = vi.hoisted(() => ({
	requireScopeRole: vi.fn(),
}));
vi.mock("~/core/scopes/access", () => ({
	ADMIN_ACCESS: "representative",
	requireScopeRole,
}));

import { requireModuleAdmin } from "~/core/registry/module-admin";
import {
	defineModule,
	sectionAllowedOn,
	unknownSectionKinds,
} from "~/core/router/modules";
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
	scope: { id: "root", parentId: null, path: "/", kind: "root" },
	ancestors: [],
};
const chapterAccess = {
	user: { id: "u2" },
	scope: {
		id: "c1",
		parentId: "r1",
		path: "/region/chapter/",
		kind: "chapter",
	},
	ancestors: [],
};

describe("requireModuleAdmin", () => {
	beforeEach(() => requireScopeRole.mockReset());

	it("asks for a managing role on the URL's scope", async () => {
		requireScopeRole.mockResolvedValueOnce(rootAccess);
		await requireModuleAdmin(makeEvent(), { module: "events" });
		expect(requireScopeRole).toHaveBeenCalledWith(
			expect.anything(),
			"representative",
		);
	});

	it('a section for "all" scopes: returns the access for the root and for other scopes', async () => {
		requireScopeRole.mockResolvedValueOnce(rootAccess);
		expect(await requireModuleAdmin(makeEvent(), { module: "events" })).toEqual(
			{ ...rootAccess, isRoot: true, adminBase: "/admin/root" },
		);
		requireScopeRole.mockResolvedValueOnce(chapterAccess);
		expect(await requireModuleAdmin(makeEvent(), { module: "events" })).toEqual(
			{
				...chapterAccess,
				isRoot: false,
				adminBase: "/admin/region.chapter",
			},
		);
	});

	it("a root-only section: returns the access on the root, 404s elsewhere", async () => {
		requireScopeRole.mockResolvedValueOnce(rootAccess);
		expect(
			await requireModuleAdmin(makeEvent(), { module: "qualifications" }),
		).toMatchObject({ isRoot: true });
		requireScopeRole.mockResolvedValueOnce(chapterAccess);
		await expect(
			requireModuleAdmin(makeEvent(), { module: "qualifications" }),
		).rejects.toMatchObject({ error: { status: 404 } });
	});

	it("404s for an inactive module or an unknown section", async () => {
		requireScopeRole.mockResolvedValue(rootAccess);
		await expect(
			requireModuleAdmin(makeEvent(), { module: "nope" }),
		).rejects.toMatchObject({ error: { status: 404 } });
		await expect(
			requireModuleAdmin(makeEvent(), { module: "jobs", section: "nope" }),
		).rejects.toMatchObject({ error: { status: 404 } });
	});

	it("propagates the auth helper's redirect and checks auth before the module", async () => {
		requireScopeRole.mockRejectedValueOnce({
			redirect: { status: 302, url: "/login" },
		});
		await expect(
			requireModuleAdmin(makeEvent(), { module: "nope" }),
		).rejects.toEqual({ redirect: { status: 302, url: "/login" } });
	});
});

describe("admin sections limited to scope kinds", () => {
	const root = { parentId: null, kind: "root" };
	const region = { parentId: "r", kind: "region" };
	const chapter = { parentId: "g", kind: "chapter" };

	it("defaults to the root only", () => {
		expect(sectionAllowedOn({}, root)).toBe(true);
		expect(sectionAllowedOn({}, region)).toBe(false);
		expect(sectionAllowedOn({ scopes: "root" }, chapter)).toBe(false);
	});

	it('"all" exists everywhere', () => {
		for (const s of [root, region, chapter]) {
			expect(sectionAllowedOn({ scopes: "all" }, s)).toBe(true);
		}
	});

	it('a list of kinds exists on those kinds; "root" names the root', () => {
		const section = { scopes: ["root", "region"] };
		expect(sectionAllowedOn(section, root)).toBe(true);
		expect(sectionAllowedOn(section, region)).toBe(true);
		expect(sectionAllowedOn(section, chapter)).toBe(false);
		expect(sectionAllowedOn({ scopes: ["chapter"] }, root)).toBe(false);
	});

	it("finds kinds the deployment does not configure", () => {
		const mod = defineModule({
			id: "m",
			admin: {
				sections: [
					{ path: "a", label: "A", scopes: ["region", "district"] },
					{ path: "b", label: "B", scopes: "all" },
				],
			},
		});
		expect(unknownSectionKinds([mod], ["region", "chapter"])).toEqual([
			"m/a: district",
		]);
	});

	it("every registered module uses configured kinds only", async () => {
		const { allModules } = await import("~/core/registry/manifests");
		const { env } = await import("~/env");
		expect(unknownSectionKinds(allModules, env.SCOPE_KINDS)).toEqual([]);
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

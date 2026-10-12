import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
	formAssignmentsService,
	formsService,
} from "~/core/forms/forms.service";
import { ONBOARDING_PURPOSE } from "~/core/forms/purposes";
import { activeModules, allModules } from "~/core/registry/manifests";
import {
	buildRequirementList,
	requirements,
} from "~/core/registry/requirements";
import { coreRequirements } from "~/core/requirements/core-requirements";
import {
	defineRequirement,
	GLOBAL_CONTEXT,
	RequirementInputError,
} from "~/core/requirements/define";
import { createRequirementsApi } from "~/core/requirements/requirements";
import { requirementsService } from "~/core/requirements/requirements.service";
import { defineModule, selectActive } from "~/core/router/modules";
import { scopesService } from "~/core/scopes/scopes.service";
import { findPrivateFields } from "~/core/shared/no-private-fields";
import { participationService } from "~/modules/events/services/participation";
import { REQUIREMENT_VERSIONS } from "../../scripts/seed-requirements";
import { createTestEvent, createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];

const consent = (version = 1, applies = () => true) =>
	defineRequirement({
		id: `test.consent${tag}`,
		version,
		contexts: ["test.checkout"],
		title: "Consent",
		input: z.object({
			given: z.enum(["true", "false"]).transform((v) => v === "true"),
		}),
		fields: [
			{
				name: "given",
				label: "Consent",
				type: "radio",
				options: [
					{ value: "true", label: "Yes" },
					{ value: "false", label: "No" },
				],
			},
		],
		isApplicable: applies,
	});

const basics = defineRequirement({
	id: `test.basics${tag}`,
	version: 1,
	contexts: [GLOBAL_CONTEXT],
	title: "Basics",
	input: z.object({ nick: z.string().trim().min(2, "Too short") }),
	fields: [{ name: "nick", label: "Nick", type: "text" }],
});

function newUser() {
	const u = createTestUser();
	cleanups.push(u.cleanup);
	return { id: u.userId };
}

afterAll(() => {
	for (const c of cleanups.reverse()) c();
	const db = openDb();
	db.prepare("DELETE FROM user_requirements WHERE requirement_id LIKE ?").run(
		`test.%${tag}`,
	);
	db.close();
});

describe("defineRequirement", () => {
	const base = {
		id: "x.y",
		version: 1,
		contexts: [],
		title: "T",
		input: z.object({}),
		fields: [{ name: "a", label: "A", type: "text" as const }],
	};

	it("accepts a well-formed definition", () => {
		expect(defineRequirement(base).id).toBe("x.y");
	});

	it("rejects a bad id, version, missing schema or no view/fields", () => {
		expect(() => defineRequirement({ ...base, id: "noarea" })).toThrow();
		expect(() => defineRequirement({ ...base, version: 0 })).toThrow();
		expect(() => defineRequirement({ ...base, version: 1.5 })).toThrow();
		expect(() =>
			defineRequirement({ ...base, input: undefined as never }),
		).toThrow(/input schema/);
		expect(() => defineRequirement({ ...base, fields: [] })).toThrow(
			/view or fields/,
		);
	});
});

describe("requirement registry", () => {
	const mod = (id: string, reqId: string) =>
		defineModule({
			id,
			requirements: [{ ...basics, id: reqId }],
		});

	it("collects core first, then active modules only", () => {
		const a = mod("alpha", "alpha.one");
		const b = mod("beta", "beta.one");
		const ids = buildRequirementList(
			coreRequirements,
			selectActive([a, b], ["beta"]),
		).map((d) => d.id);
		expect(ids).toEqual([
			"core.profile",
			"core.location",
			"core.onboarding",
			"beta.one",
		]);
	});

	it("rejects duplicates and ids outside the module's namespace", () => {
		expect(() =>
			buildRequirementList(coreRequirements, [mod("alpha", "beta.one")]),
		).toThrow(/must start with "alpha\."/);
		expect(() =>
			buildRequirementList(coreRequirements, [
				mod("alpha", "alpha.one"),
				defineModule({
					id: "alpha2",
					requirements: [{ ...basics, id: "alpha.one" }],
				}),
			]),
		).toThrow();
		expect(() =>
			buildRequirementList([...coreRequirements, coreRequirements[0]], []),
		).toThrow(/Duplicate/);
	});

	it("the live registry has core's requirements and the active modules'", () => {
		expect(requirements.ids()).toEqual(
			buildRequirementList(coreRequirements, activeModules).map((d) => d.id),
		);
		expect(requirements.ids().slice(0, 3)).toEqual([
			"core.profile",
			"core.location",
			"core.onboarding",
		]);
	});
});

describe("seeded completions", () => {
	it("seeds and e2e fixtures complete every requirement at its current version", () => {
		const live = Object.fromEntries(
			buildRequirementList(coreRequirements, allModules).map((d) => [
				d.id,
				d.version,
			]),
		);
		expect(REQUIREMENT_VERSIONS).toEqual(live);
	});
});

describe("events requirements", () => {
	it("apply while the events module is active, not when it is inactive", () => {
		expect(requirements.ids()).toEqual(
			expect.arrayContaining(["events.foodPreference", "events.photoConsent"]),
		);
		const withoutEvents = selectActive(
			allModules,
			allModules.map((m) => m.id).filter((id) => id !== "events"),
		);
		expect(
			buildRequirementList(coreRequirements, withoutEvents).map((d) => d.id),
		).toEqual(["core.profile", "core.location", "core.onboarding"]);
	});

	it("checkout asks food preference then photo consent, once", async () => {
		const user = newUser();
		expect(
			(await requirements.pending(user, "event.checkout")).map((p) => p.id),
		).toEqual(["events.foodPreference", "events.photoConsent"]);
		await expect(
			requirements.submit(user, "events.foodPreference", {
				foodPreference: "pizza",
			}),
		).rejects.toBeInstanceOf(RequirementInputError);
		await requirements.submit(user, "events.foodPreference", {
			foodPreference: "vegan",
		});
		await requirements.submit(user, "events.photoConsent", {
			photoConsentGiven: "false",
		});
		expect(await requirements.pending(user, "event.checkout")).toEqual([]);
		// The checkout context never gates the whole site.
		expect(
			(await requirements.pending(user, GLOBAL_CONTEXT)).map((p) => p.id),
		).not.toContain("events.photoConsent");
		const values = await requirementsService.valuesByUser(
			["events.foodPreference", "events.photoConsent"],
			[user.id],
		);
		expect(values.get(user.id)).toEqual({
			"events.foodPreference": { foodPreference: "vegan" },
			"events.photoConsent": { photoConsentGiven: false },
		});
	});
});

describe("admin participant list", () => {
	it("reads food preference and photo consent from requirement values", async () => {
		const organiser = newUser();
		const answered = newUser();
		const silent = newUser();
		const { eventId, cleanup } = createTestEvent(organiser.id);
		cleanups.push(cleanup);
		await participationService.upsert(answered.id, eventId, "yes");
		await participationService.upsert(silent.id, eventId, "maybe");
		await requirements.submit(answered, "events.foodPreference", {
			foodPreference: "gluten_free",
		});
		await requirements.submit(answered, "events.photoConsent", {
			photoConsentGiven: "true",
		});
		const rows =
			await participationService.getByEventIdWithEmailsAndRequirementValues(
				eventId,
			);
		const byUser = new Map(rows.map((r) => [r.userId, r]));
		expect(byUser.get(answered.id)).toMatchObject({
			foodPreference: "Gluten-free",
			photoConsentGiven: true,
		});
		expect(byUser.get(silent.id)).toMatchObject({
			foodPreference: null,
			photoConsentGiven: null,
		});
	});
});

describe("pending and submit", () => {
	it("is per context: a checkout requirement does not gate global", async () => {
		const api = createRequirementsApi([basics, consent()]);
		const user = newUser();
		expect((await api.pending(user, GLOBAL_CONTEXT)).map((p) => p.id)).toEqual([
			basics.id,
		]);
		expect((await api.pending(user, "test.checkout")).map((p) => p.id)).toEqual(
			[consent().id],
		);
		expect(await api.pending(user, "elsewhere")).toEqual([]);
	});

	it("stores the completion at the current version with its value", async () => {
		const api = createRequirementsApi([consent()]);
		const user = newUser();
		const other = newUser();
		await api.submit(user, consent().id, { given: "true" });
		expect(await api.pending(user, "test.checkout")).toEqual([]);
		// Another user's row does not count.
		expect(await api.pending(other, "test.checkout")).toHaveLength(1);
		const values = await requirementsService.valuesByUser(
			[consent().id],
			[user.id, other.id],
		);
		expect(values.get(user.id)).toEqual({ [consent().id]: { given: true } });
		expect(values.has(other.id)).toBe(false);
	});

	it("bumping the version makes it pending again, prefilled with the old answer", async () => {
		const user = newUser();
		await createRequirementsApi([consent(1)]).submit(user, consent().id, {
			given: "false",
		});
		const bumped = createRequirementsApi([consent(2)]);
		expect(await bumped.pending(user, "test.checkout")).toEqual([
			{ id: consent().id, title: "Consent", version: 2 },
		]);
		const [step] = await bumped.steps(user, "test.checkout");
		expect(step.values).toEqual({ given: false });
		await bumped.submit(user, consent().id, { given: "true" });
		expect(await bumped.pending(user, "test.checkout")).toEqual([]);
	});

	it("a requirement that does not apply is not pending and cannot be submitted", async () => {
		const api = createRequirementsApi([consent(1, () => false)]);
		const user = newUser();
		expect(await api.pending(user, "test.checkout")).toEqual([]);
		await expect(
			api.submit(user, consent().id, { given: "true" }),
		).rejects.toBeInstanceOf(RequirementInputError);
	});

	it("validates on the server with the requirement's schema; nothing stored on failure", async () => {
		const api = createRequirementsApi([basics, consent()]);
		const user = newUser();
		const err = await api
			.submit(user, basics.id, { nick: " x " })
			.catch((e) => e);
		expect(err).toBeInstanceOf(RequirementInputError);
		expect(err.fieldErrors).toEqual({ nick: "Too short" });
		await expect(
			api.submit(user, consent().id, { given: "maybe" }),
		).rejects.toBeInstanceOf(RequirementInputError);
		await expect(api.submit(user, "test.unknown", {})).rejects.toThrow(
			/Unknown step/,
		);
		expect(
			await requirementsService.rowsFor(user.id, [basics.id, consent().id]),
		).toEqual([]);
	});

	it("steps carry fields and no stored private data of others", async () => {
		const api = createRequirementsApi([basics, consent()]);
		const user = newUser();
		const steps = await api.steps(user, "test.checkout");
		expect(steps).toEqual([
			expect.objectContaining({
				id: consent().id,
				view: null,
				values: {},
				fields: consent().fields,
			}),
		]);
		expect(findPrivateFields(steps)).toEqual([]);
	});
});

describe("core requirements", () => {
	it("profile basics and location write the user's row", async () => {
		const user = newUser();
		expect(
			(await requirements.pending(user, GLOBAL_CONTEXT)).map((p) => p.id),
		).toEqual(expect.arrayContaining(["core.profile", "core.location"]));
		await expect(
			requirements.submit(user, "core.profile", { name: "", familyName: "X" }),
		).rejects.toBeInstanceOf(RequirementInputError);
		await requirements.submit(user, "core.profile", {
			name: "Ada",
			familyName: "Lovelace",
			yearOfBirth: "1990",
			sex: "female",
			profilePicture: "private/other/secret.png",
		});
		await requirements.submit(user, "core.location", {
			city: "Berlin",
			country: "Germany",
			latitude: "52.5",
			longitude: "13.4",
		});
		const db = openDb();
		const row = db
			.prepare(
				"SELECT name, family_name, year_of_birth, sex, city, latitude, profile_picture FROM users WHERE id = ?",
			)
			.get(user.id);
		db.close();
		expect(row).toEqual({
			name: "Ada",
			family_name: "Lovelace",
			year_of_birth: 1990,
			sex: "female",
			city: "Berlin",
			latitude: "52.5",
			// A key outside the profile-picture prefixes is dropped.
			profile_picture: null,
		});
		const pending = (await requirements.pending(user, GLOBAL_CONTEXT)).map(
			(p) => p.id,
		);
		expect(pending).not.toContain("core.profile");
		expect(pending).not.toContain("core.location");
	});

	it("location rejects a bad coordinate", async () => {
		await expect(
			requirements.submit(newUser(), "core.location", { latitude: "north" }),
		).rejects.toBeInstanceOf(RequirementInputError);
	});

	it("the onboarding survey applies only while an onboarding form is active", async () => {
		const root = await scopesService.ensureRoot();
		const previous = await formAssignmentsService.activeFor(
			ONBOARDING_PURPOSE,
			root.id,
		);
		const author = newUser();
		const form = await formsService.create({
			scopeId: root.id,
			title: `Onboarding ${tag}`,
			slug: `onboarding-${tag}`,
			purpose: ONBOARDING_PURPOSE,
			createdBy: author.id,
			schema: {
				pages: [
					{
						name: "p",
						elements: [
							{
								type: "radiogroup",
								name: "status",
								title: "Status",
								isRequired: true,
								choices: ["student", "alumni"],
							},
						],
					},
				],
			},
		});
		try {
			await formAssignmentsService.setActive(ONBOARDING_PURPOSE, root.id, null);
			const user = newUser();
			expect(
				(await requirements.pending(user, GLOBAL_CONTEXT)).map((p) => p.id),
			).not.toContain("core.onboarding");

			await formAssignmentsService.setActive(
				ONBOARDING_PURPOSE,
				root.id,
				form.id,
			);
			expect(
				(await requirements.pending(user, GLOBAL_CONTEXT)).map((p) => p.id),
			).toContain("core.onboarding");
			const step = (await requirements.steps(user, GLOBAL_CONTEXT)).find(
				(s) => s.id === "core.onboarding",
			);
			expect(step?.view).toBe("core.form");
			expect(
				(step?.data?.questions as Array<{ name: string }>).map((q) => q.name),
			).toEqual(["status"]);

			const err = await requirements
				.submit(user, "core.onboarding", { answers: { status: "teacher" } })
				.catch((e) => e);
			expect(err).toBeInstanceOf(RequirementInputError);
			expect(Object.keys(err.fieldErrors)).toEqual(["status"]);

			await requirements.submit(user, "core.onboarding", {
				answers: { status: "alumni" },
			});
			expect(
				(await requirements.pending(user, GLOBAL_CONTEXT)).map((p) => p.id),
			).not.toContain("core.onboarding");
			const db = openDb();
			const result = db
				.prepare(
					"SELECT answers FROM form_results WHERE form_id = ? AND user_id = ?",
				)
				.get(form.id, user.id) as { answers: string };
			db.close();
			expect(JSON.parse(result.answers)).toEqual({ status: "alumni" });
		} finally {
			await formAssignmentsService.setActive(
				ONBOARDING_PURPOSE,
				root.id,
				previous?.id ?? null,
			);
			const db = openDb();
			db.prepare("DELETE FROM form_results WHERE form_id = ?").run(form.id);
			db.prepare("DELETE FROM forms WHERE id = ?").run(form.id);
			db.close();
		}
	});
});

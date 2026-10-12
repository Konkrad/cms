import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	answerRows,
	FormAnswerError,
	validateAnswers,
} from "~/core/forms/answers";
import { formResultsService } from "~/core/forms/form-results.service";
import {
	FormInputError,
	FormLockedError,
	formAssignmentsService,
	formsService,
} from "~/core/forms/forms.service";
import { isSurveyForm } from "~/core/forms/purposes";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const PURPOSE = `test.purpose-${tag}`;
const cleanups: Array<() => void> = [];
let root: Scope;
let region: Scope;
let chapter: Scope;
let otherRegion: Scope;
let author: string;

const schema = {
	pages: [
		{
			name: "p1",
			elements: [
				{ type: "text", name: "name", title: "Name", isRequired: true },
				{ type: "comment", name: "story", title: "Story" },
				{
					type: "radiogroup",
					name: "size",
					title: "Size",
					choices: [
						{ value: "s", text: "Small" },
						{ value: "l", text: "Large" },
					],
				},
				{
					type: "checkbox",
					name: "days",
					title: "Days",
					choices: ["mon", "tue"],
				},
				{ type: "rating", name: "score", title: "Score", rateMax: 5 },
				{ type: "boolean", name: "ok", title: "OK?" },
				{
					type: "text",
					name: "why",
					title: "Why",
					isRequired: true,
					visibleIf: "{size} = 'l'",
				},
			],
		},
	],
};

async function form(scopeId: string, purpose: string | null = PURPOSE) {
	return formsService.create({
		scopeId,
		title: `Form ${tag}`,
		slug: `form-${tag}`,
		schema,
		purpose,
		createdBy: author,
	});
}

beforeAll(async () => {
	root = await scopesService.ensureRoot();
	region = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `fr-${tag}`, name: "FR" },
		new Set(),
	);
	chapter = await scopesService.create(
		{ parentId: region.id, kind: "chapter", slug: "city", name: "City" },
		new Set(),
	);
	otherRegion = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `fo-${tag}`, name: "FO" },
		new Set(),
	);
	const u = createTestUser();
	cleanups.push(u.cleanup);
	author = u.userId;
});

afterAll(() => {
	const db = openDb();
	for (const s of [chapter, region, otherRegion]) {
		db.prepare("DELETE FROM form_assignments WHERE scope_id = ?").run(s.id);
		db.prepare(
			"DELETE FROM form_results WHERE form_id IN (SELECT id FROM forms WHERE scope_id = ?)",
		).run(s.id);
		db.prepare("DELETE FROM forms WHERE scope_id = ?").run(s.id);
	}
	db.prepare("DELETE FROM form_assignments WHERE purpose = ?").run(PURPOSE);
	db.prepare(
		"DELETE FROM form_results WHERE form_id IN (SELECT id FROM forms WHERE purpose = ?)",
	).run(PURPOSE);
	db.prepare("DELETE FROM forms WHERE purpose = ?").run(PURPOSE);
	for (const s of [chapter, region, otherRegion])
		db.prepare("DELETE FROM scopes WHERE id = ?").run(s.id);
	db.close();
	for (const c of cleanups.reverse()) c();
});

describe("validateAnswers", () => {
	it("accepts valid answers and coerces form posts", () => {
		expect(
			validateAnswers(schema, {
				name: " Ada ",
				size: "s",
				days: ["mon", "tue", "mon"],
				score: "4",
				ok: "on",
			}),
		).toEqual({
			name: "Ada",
			size: "s",
			days: ["mon", "tue"],
			score: 4,
			ok: true,
		});
	});

	it("rejects a missing required answer, unknown keys and values outside the options", () => {
		const errors = (raw: unknown) => {
			try {
				validateAnswers(schema, raw);
			} catch (error) {
				expect(error).toBeInstanceOf(FormAnswerError);
				return (error as FormAnswerError).fieldErrors;
			}
			throw new Error("expected FormAnswerError");
		};
		expect(errors({})).toHaveProperty("name");
		expect(errors({ name: "x", hack: 1 })).toHaveProperty("hack");
		expect(errors({ name: "x", size: "xl" })).toHaveProperty("size");
		expect(errors({ name: "x", days: ["sun"] })).toHaveProperty("days");
		expect(errors({ name: "x", score: 9 })).toHaveProperty("score");
		expect(errors({ name: "x", ok: "maybe" })).toHaveProperty("ok");
		expect(errors({ name: { html: "<b>" } })).toHaveProperty("name");
		expect(errors({ name: "x".repeat(6000) })).toHaveProperty("name");
	});

	it("requires a conditional question only while it is visible, and drops hidden answers", () => {
		expect(() => validateAnswers(schema, { name: "x", size: "l" })).toThrow(
			FormAnswerError,
		);
		expect(
			validateAnswers(schema, { name: "x", size: "s", why: "hidden" }),
		).toEqual({ name: "x", size: "s" });
	});

	it("keeps free text as plain text: markup is stored verbatim, never sanitized into HTML", () => {
		const story = '<b>bold</b><script>alert("x")</script>\nline two';
		const answers = validateAnswers(schema, { name: "x", story });
		expect(answers.story).toBe(story);
		const rows = answerRows(schema, answers);
		expect(rows.find((r) => r.name === "story")?.answer).toBe(story);
		expect(rows.find((r) => r.name === "name")?.question).toBe("Name");
	});

	it("shows choice labels in answer rows", () => {
		const rows = answerRows(schema, { name: "x", size: "l", ok: false });
		expect(rows.find((r) => r.name === "size")?.answer).toBe("Large");
		expect(rows.find((r) => r.name === "ok")?.answer).toBe("No");
	});
});

describe("locking and duplicate", () => {
	it("locks a form after its first result; settings stay editable; the copy is unlocked", async () => {
		const f = await form(region.id, null);
		const changed = {
			...schema,
			pages: [
				{ ...schema.pages[0], elements: schema.pages[0].elements.slice(0, 1) },
			],
		};
		expect(await formsService.isLocked(f.id)).toBe(false);
		await formsService.update(f.id, { schema: changed });
		await formResultsService.create({
			formId: f.id,
			userId: author,
			answers: { name: "x" },
		});
		expect(await formsService.isLocked(f.id)).toBe(true);
		await expect(formsService.update(f.id, { schema })).rejects.toBeInstanceOf(
			FormLockedError,
		);
		// The unchanged schema and other settings are fine.
		const renamed = await formsService.update(f.id, {
			schema: changed,
			title: "Renamed",
		});
		expect(renamed?.title).toBe("Renamed");

		const copy = await formsService.duplicate(f.id, author);
		expect(copy.id).not.toBe(f.id);
		expect(copy.scopeId).toBe(region.id);
		expect(copy.schema).toEqual(renamed?.schema);
		expect(copy.slug).not.toBe(f.slug);
		expect(await formsService.isLocked(copy.id)).toBe(false);
		await formsService.update(copy.id, { schema });
		expect((await formsService.getById(copy.id))?.schema).toEqual(schema);
	});
});

describe("active form per purpose", () => {
	it("the nearest scope up the tree with an assignment wins", async () => {
		const rootForm = await form(root.id);
		const regionForm = await form(region.id);
		await formAssignmentsService.setActive(PURPOSE, root.id, rootForm.id);
		expect(
			(await formAssignmentsService.activeFor(PURPOSE, chapter.id))?.id,
		).toBe(rootForm.id);
		await formAssignmentsService.setActive(PURPOSE, region.id, regionForm.id);
		expect(
			(await formAssignmentsService.activeFor(PURPOSE, chapter.id))?.id,
		).toBe(regionForm.id);
		expect(
			(await formAssignmentsService.activeFor(PURPOSE, region.id))?.id,
		).toBe(regionForm.id);
		expect(
			(await formAssignmentsService.activeFor(PURPOSE, otherRegion.id))?.id,
		).toBe(rootForm.id);
		// Clearing the region's own choice falls back to the root's.
		await formAssignmentsService.setActive(PURPOSE, region.id, null);
		expect(
			(await formAssignmentsService.activeFor(PURPOSE, chapter.id))?.id,
		).toBe(rootForm.id);
		expect(
			await formAssignmentsService.activeFor("test.none", chapter.id),
		).toBe(undefined);
	});

	it("rejects a form of another purpose or of a scope that is not an ancestor", async () => {
		const survey = await form(root.id, null);
		await expect(
			formAssignmentsService.setActive(PURPOSE, region.id, survey.id),
		).rejects.toBeInstanceOf(FormInputError);
		const siblings = await form(otherRegion.id);
		await expect(
			formAssignmentsService.setActive(PURPOSE, chapter.id, siblings.id),
		).rejects.toBeInstanceOf(FormInputError);
	});

	it("only surveys and the onboarding survey are filled on their own page", () => {
		expect(isSurveyForm({ purpose: null })).toBe(true);
		expect(isSurveyForm({ purpose: "core.onboarding" })).toBe(true);
		expect(isSurveyForm({ purpose: "events.proposal" })).toBe(false);
	});
});

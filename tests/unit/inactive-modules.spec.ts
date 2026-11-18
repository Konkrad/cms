import { beforeAll, describe, expect, it, vi } from "vitest";
import { fakeRequestEvent } from "./request-event";

// Every module switched off (CMS_MODULES="" or an empty `active` list): spec 4.1 and the guide's
// table of what an inactive module still does.
vi.mock("../../modules.config", () => ({ default: { active: [] } }));
// Slot components use `server$`; the router runtime does not load in unit tests.
vi.mock("@qwik.dev/router", async () => {
	const { z } = await import("zod");
	const stub = (value: unknown) => value;
	return {
		server$: stub,
		serverQrl: stub,
		routeAction$: stub,
		routeActionQrl: stub,
		zod$: stub,
		zodQrl: stub,
		z,
		Form: () => null,
		Link: () => null,
	};
});

const APP = "http://localhost:5173";

beforeAll(async () => {
	await import("~/core/registry/manifests");
}, 60_000);

describe("with every module inactive", () => {
	it("routes, admin pages and API endpoints answer 404", async () => {
		const { requireActiveModule, allModules } = await import(
			"~/core/registry/manifests"
		);
		for (const m of allModules) {
			const { event } = fakeRequestEvent(`${APP}/${m.id}`);
			expect(() => requireActiveModule(event, m.id), m.id).toThrow();
			try {
				requireActiveModule(event, m.id);
			} catch (err) {
				expect(err).toMatchObject({ status: 404 });
			}
		}
	});

	it("contributes no pages, admin sections, menu links, feeds, sitemap entries or upload prefixes", async () => {
		const m = await import("~/core/registry/manifests");
		expect(m.activeModules).toEqual([]);
		expect(m.modulePages).toEqual([]);
		expect(m.activeAdminSections).toEqual([]);
		expect(m.activeMenuLinks).toEqual([]);
		expect(m.activeUserMenuLinks).toEqual([]);
		expect(m.activeFeeds).toEqual([]);
		const { sitemapEntriesOf } = await import("~/core/router/modules");
		expect(await sitemapEntriesOf(m.activeModules)).toEqual([]);
		const { activeUploadRules } = await import("~/core/registry/uploads");
		expect(activeUploadRules).toEqual([]);
		const { getStaticMenuLinks } = await import(
			"~/core/content/static-menu-links"
		);
		expect(getStaticMenuLinks().map((l) => l.url)).not.toContain("/events");
	});

	it("hides its blocks and renders none of its slots", async () => {
		const { disabledBlocks, moduleBlocks } = await import(
			"~/core/registry/blocks"
		);
		for (const type of Object.values(moduleBlocks).flat())
			expect(disabledBlocks.has(type)).toBe(true);
		const { activeSlotComponents } = await import("~/core/registry/slots");
		const { SLOT_NAMES } = await import("~/contracts/slots");
		for (const name of SLOT_NAMES)
			expect(activeSlotComponents(name)).toEqual([]);
	});

	it("runs no schedules, asks no requirements, offers no form purposes", async () => {
		const { activeSchedules } = await import("~/core/registry/schedules");
		expect(activeSchedules().every((s) => s.key.startsWith("core."))).toBe(
			true,
		);
		const { requirements } = await import("~/core/registry/requirements");
		expect(requirements.ids().every((id) => id.startsWith("core."))).toBe(true);
		const { formPurposes } = await import("~/core/registry/forms");
		expect(formPurposes().every((p) => p.purpose.startsWith("core."))).toBe(
			true,
		);
	});

	it("serves no module catalog and validates no module settings", async () => {
		const { catalog } = await import("~/core/i18n/catalog");
		const keys = Object.keys(catalog.messages);
		expect(keys.some((k) => k.startsWith("events."))).toBe(false);
		expect(keys.some((k) => k.startsWith("core."))).toBe(true);
		const { env } = await import("~/env");
		expect(env.MODULE_SETTINGS).toEqual({});
		const { moduleSettings } = await import("~/core/registry/module-settings");
		expect(() => moduleSettings("social-web")).toThrow(/inactive/);
	});

	it("still resolves its payment and review handlers and its notifications", async () => {
		const { resolveHandlerCall } = await import("~/core/registry/handlers");
		expect(
			resolveHandlerCall({
				kind: "payments",
				owner: "events",
				type: "tickets",
				hook: "onPaid",
			}),
		).toBeTypeOf("function");
		expect(
			resolveHandlerCall({
				kind: "reviews",
				owner: "events",
				type: "event",
				hook: "onApproved",
			}),
		).toBeTypeOf("function");
		const { getNotificationDefinition, activeOptionalNotifications } =
			await import("~/core/registry/notifications");
		expect(getNotificationDefinition("jobs.approved")).toBeDefined();
		expect(
			getNotificationDefinition("events.ticket-confirmation"),
		).toBeDefined();
		// …but users cannot mute what no active module sends.
		expect(
			activeOptionalNotifications().some((d) => d.id.startsWith("jobs.")),
		).toBe(false);
	});

	it("resolves references to its items as unavailable", async () => {
		const { resolveRef, resolveRefs } = await import("~/core/registry/refs");
		expect(await resolveRef("events:event:missing-or-not")).toBeNull();
		expect(await resolveRef("jobs:job:x")).toBeNull();
		const root = (await import("~/core/scopes/scopes.service")).scopesService;
		const scope = await root.ensureRoot();
		expect(
			(await resolveRefs([`scope:${scope.id}/events`])).get(
				`scope:${scope.id}/events`,
			),
		).toBeNull();
	});
});

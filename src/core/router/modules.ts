import type { Component } from "@qwik.dev/core";
import type { ZodObject } from "zod";
import type { SlotComponents, SlotName, SlotProps } from "~/contracts/slots";
import type { ModuleSeed } from "~/core/db/seed";
import type { FormPurpose } from "~/core/forms/purposes";
import type { NotificationDefinition } from "~/core/notifications/define";
import type { PaymentHandlers } from "~/core/payments/payments";
import type { RequirementDefinition } from "~/core/requirements/define";
import type { ReviewHandlers } from "~/core/reviews/define";
import type { PageDefinition } from "~/core/router/pages";
import type { UploadRule } from "~/core/router/uploads";
import type { ScheduleDefinition } from "~/core/scheduler/define";

export interface AdminSection {
	/** Path relative to the admin base path, e.g. "jobs" -> /admin/root/jobs. */
	path: string;
	label: string;
	order?: number;
	/**
	 * Which scopes' admin has the section (spec 4.8): the root only ("root", default), every
	 * scope ("all", e.g. events) or the scopes of the listed kinds (deployment configuration,
	 * `SCOPE_KINDS`; "root" for the root), e.g. ["root", "region"]. Elsewhere the `[scope]`
	 * layout and `requireModuleAdmin` answer 404. A section on other scopes than the root must
	 * limit its data to the URL scope's subtree (`isWithinScope`, `getSubtreeIds`).
	 */
	scopes?: AdminSectionScopes;
}

export type AdminSectionScopes = "root" | "all" | readonly string[];

/** Whether an admin section exists in the admin of `scope` (see `AdminSection.scopes`). */
export function sectionAllowedOn(
	section: Pick<AdminSection, "scopes">,
	scope: { parentId: string | null; kind: string },
): boolean {
	const rule = section.scopes ?? "root";
	if (rule === "all") return true;
	const isRoot = scope.parentId === null;
	if (rule === "root") return isRoot;
	return rule.includes(isRoot ? "root" : scope.kind);
}

/** Kinds named by the admin sections of `modules` that `kinds` (plus "root") does not know. */
export function unknownSectionKinds(
	modules: readonly ModuleDefinition[],
	kinds: readonly string[],
): string[] {
	const known = new Set(["root", ...kinds]);
	return modules.flatMap((m) =>
		(m.admin?.sections ?? []).flatMap((s) =>
			Array.isArray(s.scopes)
				? s.scopes
						.filter((k) => !known.has(k))
						.map((k) => `${m.id}/${s.path}: ${k}`)
				: [],
		),
	);
}

export interface MenuLink {
	key: string;
	label: string;
	url: string;
	/**
	 * Where the link goes: offered for the site menus (default, the admin picks it in the menu
	 * editor), or "user": in the logged-in user's menu of the navigation (e.g. "My tickets").
	 */
	menu?: "site" | "user";
}

/** A feed a module serves, announced in every page's head (`<link rel="alternate">`) and footer. */
export interface FeedLink {
	title: string;
	/** Site path of the feed, e.g. "/feed.xml". */
	href: string;
	type:
		| "application/rss+xml"
		| "application/atom+xml"
		| "application/feed+json";
}

export interface SitemapEntry {
	/** Path with leading slash, e.g. "/deals/123". The sitemap route resolves it against APP_URL. */
	path: string;
	lastmod?: string | null;
}

/** Where one item lives: its owning scope and, when its URL uses one, its slug. */
export interface RefLocation {
	id: string;
	scopeId: string;
	/** URL slug, when the type's `path` uses `:slug` (unique within the scope). */
	slug?: string | null;
	/** Shown in the admin link picker. */
	title?: string;
	/** The item's visibility, when it has one: reviews (spec 4.9) only review public items. */
	visibility?: string;
}

/**
 * How core turns references to one item type (`<module>:<type>:<id>`) into URLs (spec 4.3).
 * Core builds every URL from the owning scope's path; the module only says where each item
 * lives. Visibility is not checked here (a URL is not a leak), but never return private data.
 */
export interface RefTypeDefinition {
	/** Label of the type in the admin link picker, e.g. "Event". */
	label: string;
	/** Path of an item's page within its scope: `:slug` or `:id`, e.g. "/events/:slug". */
	path: string;
	/** Locations of the items with these ids; an id left out is "unavailable" (gone). */
	locate: (ids: readonly string[]) => Promise<RefLocation[]>;
	/**
	 * The id of the item a `path` parameter names in a scope (a slug, or an id), or null.
	 * Default: the parameter is the id. Used to turn pasted URLs into references.
	 */
	find?: (scopeId: string, param: string) => Promise<string | null>;
	/** Public items whose title matches `query`, for the admin link picker. */
	search?: (query: string, limit: number) => Promise<RefLocation[]>;
}

export interface ModuleDefinition {
	id: string;
	/**
	 * The module's tables and relations, its `schema.ts` default export (`defineModuleSchema`).
	 * Listed in `src/core/registry/schemas.ts` too, which drizzle-kit loads without the app (a
	 * unit test checks both match); one migration history for core and every module.
	 */
	schema?: { tables: Record<string, unknown> };
	pages?: PageDefinition<unknown>[];
	/**
	 * First segments of the module's own route files in `src/routes` (machine endpoints such as
	 * feeds: `["feed.xml", "social"]`), outside the catch-all. They are reserved as scope slugs
	 * (like page paths); their handlers call `requireActiveModule` first, so they answer 404
	 * while the module is inactive.
	 */
	routes?: string[];
	/**
	 * Deployment settings (spec 4.1): a zod object whose keys are read from the environment
	 * variables `<MODULE_ID>_<KEY>` (`updateInterval` of social-web = `SOCIAL_WEB_UPDATE_INTERVAL`)
	 * and validated by src/env.ts at startup while the module is active (the server refuses to
	 * start on an invalid value). Keep it in a pure `settings.ts` (zod only) and list it in
	 * `src/core/registry/settings.ts`; read it with `moduleSettings("<id>")` from `~/core`.
	 */
	settings?: ZodObject;
	/** Feeds announced in the head of every page and linked in the footer while active. */
	feeds?: FeedLink[];
	admin?: { sections: AdminSection[] };
	menuLinks?: MenuLink[];
	/**
	 * Page-builder block types (componentType ids) this module owns. They are hidden from the
	 * admin picker and not rendered while the module is inactive. Must match the client-safe
	 * list in `src/core/registry/blocks.ts` (a unit test checks this).
	 */
	blocks?: string[];
	/** Public URLs for /sitemap.xml. Server-only. Omit for login-gated modules. */
	sitemap?: () => Promise<SitemapEntry[]>;
	/**
	 * Slots this module contributes to (spec 4.1, guide 5.9): components for screens it does not
	 * own, e.g. `["profile.sections"]` (names and props in `~/contracts/slots`). Rendered only
	 * while the module is active. Like `blocks`, the manifest (server code) lists the names; the
	 * components live in the module's client-safe `slots.tsx` (`{ [name]: Component }`), listed
	 * in `src/core/registry/slots.ts` (a unit test checks both match). Each component loads its
	 * data through a `server$()` composable that authorizes first and returns only what the
	 * viewer may see.
	 */
	slots?: SlotName[];
	/**
	 * Payment handlers by payment kind (spec 4.7), named so core can call them hours later and
	 * after a restart: core queues `payments[kind][hook]` of the module that created the payment
	 * (`payments.create`) once per status change, retries it until it succeeds, and calls it
	 * even while the module is inactive. Server-only.
	 */
	payments?: Record<string, PaymentHandlers>;
	/**
	 * Notifications this module sends (`defineNotification` from `~/core`), triggered only via
	 * `notify(id, { to, data })`. The outbox worker resolves them from every registered module,
	 * so rows queued by a module that is later deactivated are still sent.
	 */
	notifications?: NotificationDefinition[];
	/**
	 * Item types other content may reference (`<module>:<type>:<id>`): where each item lives,
	 * so core can build its canonical URL (`itemUrl`, `resolveRef`). References to a module
	 * that is not active resolve to "unavailable".
	 */
	refs?: Record<string, RefTypeDefinition>;
	/**
	 * Form purposes this module uses (spec 4.10), e.g. `{ purpose: "events.proposal", label }`.
	 * Admins pick the active form per purpose and scope; read it with `forms.active(ctx, purpose)`.
	 */
	forms?: FormPurpose[];
	/**
	 * Recurring jobs (spec 4.1), run in the server process while the module is active:
	 * `{ id, every: "1d", run(ctx) }`. A run must be safe to repeat; a failure is retried with
	 * backoff and listed in the admin failure view.
	 */
	schedules?: ScheduleDefinition[];
	/**
	 * S3 key prefixes the module uploads to through core's `/api/images`, and who may (spec 4.1,
	 * guide 5.14): `[{ prefix: "public/events/", minRole: "representative" }]`. A prefix must be
	 * `public/<id>/…` or `private/<id>/…` (core's own prefixes stay core's). The uploader needs
	 * `minRole` on the scope of the admin page uploading (`ImageUploader` sends it); only active
	 * modules' prefixes are accepted. Check stored keys against the prefix in the service.
	 */
	uploads?: UploadRule[];
	/**
	 * Demo data and e2e fixtures (spec 6): `scripts/seed.ts` and `scripts/seed-test.ts` seed core,
	 * then call this for every ACTIVE module with `ctx.mode` "demo" or "test". Import the seed
	 * code lazily (`seed: async (ctx) => (await import("./seed")).seedJobs(ctx)`): it uses dev
	 * dependencies (faker) and must stay out of the server's startup graph.
	 */
	seed?: ModuleSeed;
	/**
	 * Review handlers per item type (spec 4.9): `{ event: { onApproved, onRejected } }`, called
	 * by name after a decision on `<module>:<type>:<id>`, retried until they succeed, even while
	 * the module is inactive. Submit with `reviews.submit` from `~/core`.
	 */
	reviews?: Record<string, ReviewHandlers>;
	/**
	 * User requirements (spec 4.6) this module asks for, from `defineRequirement` (`~/core`): ids
	 * are `<module id>.<name>`, contexts like `"event.checkout"`. They apply only while the module
	 * is active; check them with `requirements.pending(user, context)` and submit them through
	 * core's single step action, never an action of your own.
	 */
	requirements?: RequirementDefinition[];
}

export function defineModule(module: ModuleDefinition): ModuleDefinition {
	return module;
}

/** The modules named in `activeIds`, in config order. Throws on unknown or duplicate ids. */
export function selectActive(
	all: readonly ModuleDefinition[],
	activeIds: readonly string[],
): ModuleDefinition[] {
	const byId = new Map<string, ModuleDefinition>();
	for (const module of all) {
		if (byId.has(module.id))
			throw new Error(`Duplicate module id: ${module.id}`);
		byId.set(module.id, module);
	}
	const seen = new Set<string>();
	return activeIds.map((id) => {
		const module = byId.get(id);
		if (!module)
			throw new Error(
				`Unknown module in modules.config.ts or CMS_MODULES: ${id}`,
			);
		if (seen.has(id))
			throw new Error(
				`Duplicate module in modules.config.ts or CMS_MODULES: ${id}`,
			);
		seen.add(id);
		return module;
	});
}

export const pagesOf = (modules: readonly ModuleDefinition[]) =>
	modules.flatMap((m) => m.pages ?? []);

/** Links of the given modules offered for the site menus. */
export const menuLinksOf = (modules: readonly ModuleDefinition[]): MenuLink[] =>
	modules.flatMap((m) => m.menuLinks ?? []).filter((l) => l.menu !== "user");

/** Links of the given modules for the logged-in user's menu ("My tickets"). */
export const userMenuLinksOf = (
	modules: readonly ModuleDefinition[],
): MenuLink[] =>
	modules.flatMap((m) => m.menuLinks ?? []).filter((l) => l.menu === "user");

export const feedsOf = (modules: readonly ModuleDefinition[]): FeedLink[] =>
	modules.flatMap((m) => m.feeds ?? []);

/** Admin nav sections of the given modules, sorted by `order` (stable). */
export const adminSectionsOf = (
	modules: readonly ModuleDefinition[],
): AdminSection[] =>
	modules
		.flatMap((m) => m.admin?.sections ?? [])
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** Sitemap entries of the given modules, in module order. */
export const sitemapEntriesOf = async (
	modules: readonly ModuleDefinition[],
): Promise<SitemapEntry[]> =>
	(await Promise.all(modules.map((m) => m.sitemap?.() ?? []))).flat();

/**
 * The components the active modules contribute to one slot, in `activeIds` order. `slots` maps
 * module id to its slot components (client-safe registry); inactive modules contribute nothing.
 */
export function slotContributionsOf<Name extends SlotName>(
	slots: Readonly<Record<string, SlotComponents>>,
	name: Name,
	activeIds: readonly string[],
): Component<SlotProps[Name]>[] {
	return activeIds.flatMap((id) => {
		const component = slots[id]?.[name] as
			| Component<SlotProps[Name]>
			| undefined;
		return component ? [component] : [];
	});
}

/** Notification definitions of the given modules, in module order. */
export const notificationsOf = (
	modules: readonly ModuleDefinition[],
): NotificationDefinition[] => modules.flatMap((m) => m.notifications ?? []);

/**
 * Requirement definitions of the given modules, in module order. Throws when an id does not start
 * with its module's id (`events.photoConsent` in the events module).
 */
export const requirementsOf = (
	modules: readonly ModuleDefinition[],
): RequirementDefinition[] =>
	modules.flatMap((m) =>
		(m.requirements ?? []).map((def) => {
			if (!def.id.startsWith(`${m.id}.`))
				throw new Error(
					`Requirement "${def.id}" of module ${m.id} must start with "${m.id}."`,
				);
			return def;
		}),
	);

/** Form purposes of the given modules, in module order. */
export const formPurposesOf = (
	modules: readonly ModuleDefinition[],
): FormPurpose[] => modules.flatMap((m) => m.forms ?? []);

/**
 * Block types owned by a module that is not active. `moduleBlocks` maps module id to its
 * block types; a type also owned by an active module stays enabled.
 */
export function disabledBlockTypes(
	moduleBlocks: Readonly<Record<string, readonly string[]>>,
	activeIds: readonly string[],
): Set<string> {
	const active = new Set(activeIds);
	const enabled = new Set<string>();
	const disabled = new Set<string>();
	for (const [id, types] of Object.entries(moduleBlocks)) {
		for (const type of types) (active.has(id) ? enabled : disabled).add(type);
	}
	for (const type of enabled) disabled.delete(type);
	return disabled;
}

/** The items whose `componentType` is not in `disabled` (picker/loader view of the block registry). */
export const withoutDisabledBlocks = <T extends { componentType: string }>(
	defs: readonly T[],
	disabled: ReadonlySet<string>,
): T[] => defs.filter((d) => !disabled.has(d.componentType));

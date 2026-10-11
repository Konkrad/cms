import type { ProfileExtras } from "~/contracts/profile";
import type { ScopeExtras } from "~/contracts/scopes";
import type { NotificationDefinition } from "~/core/notifications/define";
import type { PaymentHandlers } from "~/core/payments/payments";
import type { PageDefinition } from "~/core/router/pages";

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
}

export interface SitemapEntry {
	/** Path with leading slash, e.g. "/deals/123". The sitemap route resolves it against APP_URL. */
	path: string;
	lastmod?: string | null;
}

/** Who is looking at which profile; passed to every module's `profile` hook. */
export interface ProfileContext {
	/** The user whose profile is rendered. */
	userId: string;
	/** The logged-in viewer, null when anonymous. */
	viewerId: string | null;
	isOwnProfile: boolean;
}

/** Which scope home page is rendered and who looks at it; passed to every module's `scopePage` hook. */
export interface ScopePageContext {
	scopeId: string;
	/** The logged-in viewer, null when anonymous. */
	viewerId: string | null;
}

export interface ModuleDefinition {
	id: string;
	pages?: PageDefinition<unknown>[];
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
	 * Extra sections for the profile pages. Server-only. Return only what `ctx.viewerId` may see
	 * (e.g. nothing private unless `ctx.isOwnProfile`); the result is serialized to the browser.
	 */
	profile?: (ctx: ProfileContext) => Promise<Partial<ProfileExtras>>;
	/**
	 * Extra sections for a scope's public home page (`/germany/berlin`). Server-only. Return
	 * only what `ctx.viewerId` may see; the result is serialized to the browser.
	 */
	scopePage?: (ctx: ScopePageContext) => Promise<Partial<ScopeExtras>>;
	/**
	 * Number of this module's items owned by a scope. Server-only. A scope can only be deleted
	 * while every module (active or not) reports 0 and it has no core content or children.
	 */
	scopeContentCount?: (scopeId: string) => Promise<number>;
	/**
	 * Re-run the module's user-tag rules for one user (admin "Re-evaluate badges"). Server-only.
	 */
	reevaluateUserTags?: (userId: string) => Promise<void>;
	/**
	 * Stripe payment callbacks by payment kind. Server-only. The core webhook calls
	 * `payments[metadata.kind]` of the module named by `metadata.moduleId` on the PaymentIntent,
	 * even while the module is inactive (see `src/core/payments/payments.ts`).
	 */
	payments?: Record<string, PaymentHandlers>;
	/**
	 * Notifications this module sends (`defineNotification` from `~/core`), triggered only via
	 * `notify(id, { to, data })`. The outbox worker resolves them from every registered module,
	 * so rows queued by a module that is later deactivated are still sent.
	 */
	notifications?: NotificationDefinition[];
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
		if (!module) throw new Error(`Unknown module in modules.config: ${id}`);
		if (seen.has(id))
			throw new Error(`Duplicate module in modules.config: ${id}`);
		seen.add(id);
		return module;
	});
}

export const pagesOf = (modules: readonly ModuleDefinition[]) =>
	modules.flatMap((m) => m.pages ?? []);

export const menuLinksOf = (modules: readonly ModuleDefinition[]): MenuLink[] =>
	modules.flatMap((m) => m.menuLinks ?? []);

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

/** Profile sections contributed by the given modules, merged in module order (later wins per key). */
export const profileExtrasOf = async (
	modules: readonly ModuleDefinition[],
	ctx: ProfileContext,
): Promise<Partial<ProfileExtras>> =>
	Object.assign(
		{},
		...(await Promise.all(modules.map((m) => m.profile?.(ctx) ?? {}))),
	);

/** Scope page sections contributed by the given modules, merged in module order (later wins per key). */
export const scopeExtrasOf = async (
	modules: readonly ModuleDefinition[],
	ctx: ScopePageContext,
): Promise<Partial<ScopeExtras>> =>
	Object.assign(
		{},
		...(await Promise.all(modules.map((m) => m.scopePage?.(ctx) ?? {}))),
	);

/** Items the given modules own in a scope (summed `scopeContentCount`). */
export const scopeContentCountOf = async (
	modules: readonly ModuleDefinition[],
	scopeId: string,
): Promise<number> =>
	(
		await Promise.all(modules.map((m) => m.scopeContentCount?.(scopeId) ?? 0))
	).reduce((a, b) => a + b, 0);

/** Notification definitions of the given modules, in module order. */
export const notificationsOf = (
	modules: readonly ModuleDefinition[],
): NotificationDefinition[] => modules.flatMap((m) => m.notifications ?? []);

/** Runs the `reevaluateUserTags` hook of every given module for one user. */
export const reevaluateUserTagsOf = async (
	modules: readonly ModuleDefinition[],
	userId: string,
): Promise<void> => {
	await Promise.all(modules.map((m) => m.reevaluateUserTags?.(userId)));
};

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

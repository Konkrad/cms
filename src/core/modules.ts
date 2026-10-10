import type { GroupExtras } from "~/contracts/groups";
import type { ProfileExtras } from "~/contracts/profile";
import type { PageDefinition } from "~/core/pages";
import type { PaymentHandlers } from "~/core/payments";

export interface AdminSection {
	/** Path relative to the admin base path, e.g. "jobs" -> /admin/global/jobs. */
	path: string;
	label: string;
	order?: number;
	/**
	 * Where the entry shows: only in the global admin ("global", default) or also in every
	 * group's admin ("all", e.g. events). An "all" section's routes must authorize per group.
	 */
	scopes?: "global" | "all";
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

/** Which group page is rendered and who looks at it; passed to every module's `groupPage` hook. */
export interface GroupPageContext {
	groupId: string;
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
	 * Extra sections for the public group page (`/groups/[slug]`). Server-only. Return only what
	 * `ctx.viewerId` may see; the result is serialized to the browser.
	 */
	groupPage?: (ctx: GroupPageContext) => Promise<Partial<GroupExtras>>;
	/**
	 * Re-run the module's user-tag rules for one user (admin "Re-evaluate badges"). Server-only.
	 */
	reevaluateUserTags?: (userId: string) => Promise<void>;
	/**
	 * Stripe payment callbacks by payment kind. Server-only. The core webhook calls
	 * `payments[metadata.kind]` of the module named by `metadata.moduleId` on the PaymentIntent,
	 * even while the module is inactive (see `src/core/payments.ts`).
	 */
	payments?: Record<string, PaymentHandlers>;
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

/** Group page sections contributed by the given modules, merged in module order (later wins per key). */
export const groupExtrasOf = async (
	modules: readonly ModuleDefinition[],
	ctx: GroupPageContext,
): Promise<Partial<GroupExtras>> =>
	Object.assign(
		{},
		...(await Promise.all(modules.map((m) => m.groupPage?.(ctx) ?? {}))),
	);

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

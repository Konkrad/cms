import type { RequestEventCommon } from "@qwik.dev/router";
import {
	adminSectionsOf,
	type ModuleDefinition,
	menuLinksOf,
	type ProfileContext,
	pagesOf,
	profileExtrasOf,
	reevaluateUserTagsOf,
	type ScopePageContext,
	scopeContentCountOf,
	scopeExtrasOf,
	selectActive,
} from "~/core/router/modules";
import { reservedScopeSlugs } from "~/core/router/reserved-slugs";
import { scopesService } from "~/core/scopes/scopes.service";
import config from "../../../modules.config";
import { dealsModule } from "../../modules/deals/module";
import { electionsModule } from "../../modules/elections/module";
import { eventsModule } from "../../modules/events/module";
import { jobsModule } from "../../modules/jobs/module";
import { qualificationsModule } from "../../modules/qualifications/module";

/** Every module that exists in the codebase; `modules.config.ts` picks the active ones. */
export const allModules: ModuleDefinition[] = [
	dealsModule,
	electionsModule,
	eventsModule,
	jobsModule,
	qualificationsModule,
];

export const activeModules = selectActive(allModules, config.active);

/** Pages of active modules, matched in this order by the catch-all route. */
export const modulePages = pagesOf(activeModules);
export const activeAdminSections = adminSectionsOf(activeModules);
export const activeMenuLinks = menuLinksOf(activeModules);

/** Profile sections contributed by active modules for this viewer/profile pair. */
export const activeProfileExtras = (ctx: ProfileContext) =>
	profileExtrasOf(activeModules, ctx);

/** Scope home page sections contributed by active modules for this viewer. */
export const activeScopeExtras = (ctx: ScopePageContext) =>
	scopeExtrasOf(activeModules, ctx);

/** Items every module (active or not: their rows stay) owns in a scope. */
export const moduleScopeContentCount = (scopeId: string) =>
	scopeContentCountOf(allModules, scopeId);

/** Whether a scope owns any content (core posts/forms or any module's items). */
export async function scopeHasContent(scopeId: string): Promise<boolean> {
	const [core, modules] = await Promise.all([
		scopesService.countCoreContent(scopeId),
		moduleScopeContentCount(scopeId),
	]);
	return core + modules > 0;
}

/** Re-runs the tag rules of every active module for one user. */
export const reevaluateUserTagsForUser = (userId: string) =>
	reevaluateUserTagsOf(activeModules, userId);

/** Answers 404 unless the module is active. Call right after the auth check. */
export function requireActiveModule(
	event: RequestEventCommon,
	id: string,
): void {
	if (!activeModules.some((m) => m.id === id)) {
		throw event.error(404, "Not found");
	}
}

/** Slugs no scope may take (route segments and every module's routes); see reservedScopeSlugs. */
export const reservedSlugs = reservedScopeSlugs(allModules);

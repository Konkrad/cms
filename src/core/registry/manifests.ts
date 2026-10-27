import type { RequestEventCommon } from "@qwik.dev/router";
import {
	adminSectionsOf,
	feedsOf,
	type ModuleDefinition,
	menuLinksOf,
	pagesOf,
	selectActive,
	userMenuLinksOf,
} from "~/core/router/modules";
import { reservedScopeSlugs } from "~/core/router/reserved-slugs";
import config from "../../../modules.config";
import { dealsModule } from "../../modules/deals/module";
import { electionsModule } from "../../modules/elections/module";
import { eventsModule } from "../../modules/events/module";
import { jobsModule } from "../../modules/jobs/module";
import { qualificationsModule } from "../../modules/qualifications/module";
import { socialWebModule } from "../../modules/social-web/module";

/** Every module that exists in the codebase; `modules.config.ts` picks the active ones. */
export const allModules: ModuleDefinition[] = [
	dealsModule,
	electionsModule,
	eventsModule,
	jobsModule,
	qualificationsModule,
	socialWebModule,
];

export const activeModules = selectActive(allModules, config.active);

/** Pages of active modules, matched in this order by the catch-all route. */
export const modulePages = pagesOf(activeModules);
export const activeAdminSections = adminSectionsOf(activeModules);
export const activeMenuLinks = menuLinksOf(activeModules);
/** Links active modules add to the logged-in user's menu (navigation). */
export const activeUserMenuLinks = userMenuLinksOf(activeModules);
/** Feeds of active modules (head `<link rel="alternate">`, footer). */
export const activeFeeds = feedsOf(activeModules);

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

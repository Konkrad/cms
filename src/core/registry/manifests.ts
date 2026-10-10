import type { RequestEventCommon } from "@qwik.dev/router";
import {
	adminSectionsOf,
	type ModuleDefinition,
	menuLinksOf,
	pagesOf,
	selectActive,
} from "~/core/modules";
import { dealsModule } from "../../../modules/deals/module";
import { jobsModule } from "../../../modules/jobs/module";
import { qualificationsModule } from "../../../modules/qualifications/module";
import config from "../../../modules.config";

/** Every module that exists in the codebase; `modules.config.ts` picks the active ones. */
export const allModules: ModuleDefinition[] = [
	dealsModule,
	jobsModule,
	qualificationsModule,
];

export const activeModules = selectActive(allModules, config.active);

/** Pages of active modules, matched in this order by the catch-all route. */
export const modulePages = pagesOf(activeModules);
export const activeAdminSections = adminSectionsOf(activeModules);
export const activeMenuLinks = menuLinksOf(activeModules);

/** Answers 404 unless the module is active. Call right after the auth check. */
export function requireActiveModule(
	event: RequestEventCommon,
	id: string,
): void {
	if (!activeModules.some((m) => m.id === id)) {
		throw event.error(404, "Not found");
	}
}

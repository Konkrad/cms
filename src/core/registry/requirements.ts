import { coreRequirements } from "~/core/requirements/core-requirements";
import {
	indexRequirements,
	type RequirementDefinition,
} from "~/core/requirements/define";
import { createRequirementsApi } from "~/core/requirements/requirements";
import { type ModuleDefinition, requirementsOf } from "~/core/router/modules";
import { activeModules } from "./manifests";

/**
 * Core's requirements plus those of the given modules, in that order. Throws on a duplicate id
 * or a module requirement whose id does not start with its module id.
 */
export function buildRequirementList(
	core: readonly RequirementDefinition[],
	modules: readonly ModuleDefinition[],
): RequirementDefinition[] {
	for (const def of core)
		if (!def.id.startsWith("core."))
			throw new Error(`Core requirement "${def.id}" must start with "core."`);
	const all = [...core, ...requirementsOf(modules)];
	indexRequirements(all);
	return all;
}

/**
 * The requirements in force (spec 4.6): core's and the ACTIVE modules' (an inactive module's
 * requirements do not apply). Server-only; exported to modules as `requirements` from `~/core`.
 */
export const requirements = createRequirementsApi(() =>
	buildRequirementList(coreRequirements, activeModules),
);

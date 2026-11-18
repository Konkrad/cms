import { env } from "~/env";
import { activeModuleIds } from "./active-modules";

/**
 * The active module set is fixed at build time (`cms:modules`: client bundle, routes, i18n
 * catalog); a server started with another `CMS_MODULES` (or `modules.config.ts`) than its build
 * would serve a mixed site, so it refuses to start.
 */
export function assertBuiltModules(): void {
	const runtime = env.ACTIVE_MODULES.join(",");
	const built = activeModuleIds.join(",");
	if (runtime !== built) {
		throw new Error(
			`Active modules are "${runtime}" but this build was made for "${built}"; rebuild with CMS_MODULES=${runtime} (or run with CMS_MODULES=${built}).`,
		);
	}
}

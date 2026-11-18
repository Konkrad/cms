import { runModuleSeeds, type SeedContext } from "~/core/db/seed";
import { activeModules } from "./manifests";

/** Seeds the ACTIVE modules (spec 4.1: an inactive module adds no seed). For the seed scripts. */
export const seedActiveModules = (ctx: SeedContext) =>
	runModuleSeeds(activeModules, ctx);

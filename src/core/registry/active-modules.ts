/**
 * Ids of the active modules, in config order: `modules.config.ts`, or `CMS_MODULES` when set
 * (`resolveActiveModuleIds`). In every Vite build and the dev server the `cms:modules` plugin
 * (`./vite-plugin.ts`) REPLACES this module with the list resolved at build time, so client code
 * (block and slot gating) gets a plain array and never loads src/env.ts; the production server
 * refuses to start with another set than its build's (`assertBuiltModules`). Without Vite (tsx
 * scripts, unit tests) the list comes from src/env.ts.
 */
import { env } from "~/env";

export const activeModuleIds: readonly string[] = env.ACTIVE_MODULES;

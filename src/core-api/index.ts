/**
 * The only core surface feature modules (`modules/**`) may import, besides
 * `~/ui` and `~/contracts/*`. Enforced by the `modules/**` override in biome.json.
 * Add an export here only when a module needs it.
 */

// Module/page definition (client-safe)
export { defineModule } from "~/core/modules";
export type { PageViews } from "~/core/page-views";
export { definePage, matchPath } from "~/core/pages";

// Server-only: do not call from client code (reference only inside loaders/actions/server$).
export { db } from "~/db/connection";
export { requireActiveModule } from "~/modules";
export type { PageDirection } from "~/services/pagination";
export { decodeCursor, paginateRows } from "~/services/pagination";
export { requireGroupAdmin } from "~/utils/access-control";
export { sanitizeRichHtml } from "~/utils/sanitize-html";
export { currentScopeRest } from "~/utils/scope-request";
export { requireAuth } from "~/utils/server-auth";

// Schema references modules need to relate to core tables (also in ./db-schema).
export * from "./db-schema";

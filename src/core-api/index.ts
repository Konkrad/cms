/**
 * The only core surface feature modules (`modules/**`) may import, besides
 * `~/ui` and `~/contracts/*`. Enforced by the `modules/**` override in biome.json.
 * Add an export here only when a module needs it.
 */

// Module/page definition (client-safe)
export { defineModule } from "~/core/modules";
export type { PageViews } from "~/core/page-views";
export { definePage, matchPath } from "~/core/pages";
export { requireActiveModule } from "~/core/registry/manifests";
// Server-only: do not call from client code (reference only inside loaders/actions/server$).
export { db } from "~/db/connection";
// Server-only core services for modules (memberships tiers, user tags). Tag *rule evaluation*
// is not core; it lives in the events module (`modules/events/services/tag-rules.ts`).
export { groupMembershipsService } from "~/services/group-memberships.service";
export { membershipsService } from "~/services/memberships.service";
export type { PageDirection } from "~/services/pagination";
export {
	createCursorFromItem,
	decodeCursor,
	getNextCursorFromRows,
	paginateRows,
} from "~/services/pagination";
export { userTagsService } from "~/services/user-tags.service";
export { requireGroupAdmin } from "~/utils/access-control";
export { publicImageUrlFromKey } from "~/utils/images";
export { sanitizeRichHtml } from "~/utils/sanitize-html";
export { currentScopeRest } from "~/utils/scope-request";
export { generateSecurePhotoUrl } from "~/utils/secure-urls";
export { getServerSession, requireAuth } from "~/utils/server-auth";
// Schema references modules need to relate to core tables (also in ./db-schema).
export * from "./db-schema";
// Env-derived values (server-only).
export { getAppUrl, getStripeEnv } from "./env";

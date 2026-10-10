/**
 * The only core surface feature modules (`modules/**`) may import, besides
 * `~/ui` and `~/contracts/*`. Enforced by the `modules/**` override in biome.json.
 * Add an export here only when a module needs it.
 */

// biome-ignore-all assist/source/organizeImports: export order matters. The definePage/defineModule re-exports must come before ~/core/registry/manifests, which imports the modules, which import this file (import cycle).

// Module/page definition (client-safe)
export { defineModule } from "~/core/router/modules";
export type { PageViews } from "~/core/router/page-views";
export { definePage, matchPath } from "~/core/router/pages";

// Server-only: do not call from client code (reference only inside loaders/actions/server$).
export { db } from "~/core/db/connection";
export type { PaymentContext, PaymentHandlers } from "~/core/payments";
export type { PublicUser } from "~/core/public-user";
export { toPublicUser } from "~/core/public-user";
export { requireActiveModule } from "~/core/registry/manifests";
export { currentScopeRest } from "~/core/router/scope-request";
// Server-only core services for modules (memberships tiers, user tags). Tag *rule evaluation*
// is not core; it lives in the events module (`modules/events/services/tag-rules.ts`).
export { groupMembershipsService } from "~/services/group-memberships.service";
export { groupRepresentativesService } from "~/services/group-representatives.service";
export { groupsService } from "~/services/groups.service";
export { deleteS3Objects } from "~/services/image-processing.service";
export { membershipsService } from "~/services/memberships.service";
export type { PageDirection } from "~/services/pagination";
export {
	createCursorFromItem,
	decodeCursor,
	getNextCursorFromRows,
	paginateRows,
} from "~/services/pagination";
export { telegramService } from "~/services/telegram.service";
export { userTagsService } from "~/services/user-tags.service";
export { usersService } from "~/services/users.service";
export { requireGroupAdmin } from "~/utils/access-control";
export { deriveThumbnailKey, publicImageUrlFromKey } from "~/utils/images";
export { sanitizeRichHtml } from "~/utils/sanitize-html";
export {
	generatePresignedGetUrl,
	generateSecurePhotoUrl,
} from "~/utils/secure-urls";
export { sendEmail } from "~/utils/send-email";
export {
	getCurrentUserData,
	getServerSession,
	requireAuth,
} from "~/utils/server-auth";
export { buildProfileUrl } from "~/utils/users";
// Schema references modules need to relate to core tables (also in ./db-schema).
export * from "./db-schema";
// Env-derived values (server-only).
export { getAppUrl, getStripeEnv, getStripePublishableKey } from "./env";
// Module guards (own file: they load the registry, which imports the modules, which import this
// file back, so they must be exported after the definitions above).
export { requireModuleAdmin, requireModuleAuth } from "./guards";

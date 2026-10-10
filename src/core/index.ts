/**
 * Module API: the root files of `src/core` (this file, `schema`, `ui`, `seo`, `setup-actions`)
 * are the only core surface feature modules (`modules/**`) may import, besides `~/contracts/*`.
 * Enforced by the `modules/**` override in biome.json. Add an export here only when a module needs it.
 */

// biome-ignore-all assist/source/organizeImports: export order matters. The definePage/defineModule re-exports must come before ~/core/registry/manifests, which imports the modules, which import this file (import cycle).

import { env } from "~/env";

// Module/page definition (client-safe)
export { defineModule } from "~/core/router/modules";
export type { PageViews } from "~/core/router/page-views";
export { definePage, matchPath } from "~/core/router/pages";

// Server-only: do not call from client code (reference only inside loaders/actions/server$).
export { db } from "~/core/db/connection";
export type { PaymentContext, PaymentHandlers } from "~/core/payments/payments";
export type { PublicUser } from "~/core/users/public-user";
export { toPublicUser } from "~/core/users/public-user";
export { requireActiveModule } from "~/core/registry/manifests";
export { currentScopeRest } from "~/core/router/scope-request";
// Server-only core services for modules (memberships tiers, user tags). Tag *rule evaluation*
// is not core; it lives in the events module (`modules/events/services/tag-rules.ts`).
export { groupMembershipsService } from "~/core/scopes/group-memberships.service";
export { groupRepresentativesService } from "~/core/scopes/group-representatives.service";
export { groupsService } from "~/core/scopes/groups.service";
export { deleteS3Objects } from "~/core/media/image-processing.service";
export { membershipsService } from "~/core/memberships/memberships.service";
export type { PageDirection } from "~/core/shared/pagination";
export {
	createCursorFromItem,
	decodeCursor,
	getNextCursorFromRows,
	paginateRows,
} from "~/core/shared/pagination";
export { telegramService } from "~/core/notifications/telegram.service";
export { userTagsService } from "~/core/tags/user-tags.service";
export { usersService } from "~/core/users/users.service";
export { requireGroupAdmin } from "~/core/scopes/access-control";
export { deriveThumbnailKey, publicImageUrlFromKey } from "~/core/media/images";
export { sanitizeRichHtml } from "~/core/content/sanitize-html";
export {
	generatePresignedGetUrl,
	generateSecurePhotoUrl,
} from "~/core/media/secure-urls";
export { sendEmail } from "~/core/notifications/send-email";
export {
	getCurrentUserData,
	getServerSession,
	requireAuth,
} from "~/core/auth/server-auth";
export { buildProfileUrl } from "~/core/users/format";
// Schema references modules need to relate to core tables (also in ./schema).
export * from "./schema";
// Module guards. They load the registry, which imports the modules, which import this file
// back, so they must stay after the definitions above.
export { requireModuleAdmin } from "~/core/registry/module-admin";
export { requireModuleAuth } from "~/core/registry/module-auth";

// Env-derived values (server-only). Modules must not import `~/env`; add a getter here instead.
/** Public base URL of this site (no trailing-slash guarantee). */
export const getAppUrl = (): string => env.APP_URL;

/** Stripe client settings (secret key plus optional dev/proxy overrides). */
export const getStripeEnv = () => ({
	secretKey: env.STRIPE_SECRET_KEY,
	apiBaseUrl: env.STRIPE_API_BASE_URL,
	proxyUrl: env.STRIPE_PROXY_URL,
});

/** Stripe publishable key handed to the browser for Stripe.js. */
export const getStripePublishableKey = (): string => env.STRIPE_PUBLISHABLE_KEY;

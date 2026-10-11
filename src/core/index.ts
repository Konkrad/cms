/**
 * Module API: the root files of `src/core` (this file, `schema`, `ui`, `seo`, `setup-actions`)
 * are the only core surface feature modules (`src/modules/**`) may import, besides `~/contracts/*`.
 * Enforced by the `src/modules/**` override in biome.json. Add an export here only when a module needs it.
 */

// biome-ignore-all assist/source/organizeImports: export order matters. The definePage/defineModule re-exports must come before ~/core/registry/manifests, which imports the modules, which import this file (import cycle).

import { env } from "~/env";

// Module/page definition (client-safe)
export { defineModule } from "~/core/router/modules";
export type { PageViews } from "~/core/router/page-views";
export { definePage, matchPath } from "~/core/router/pages";
export type {
	ChannelId,
	EmailContent,
	NotificationDefinition,
	RenderContext,
} from "~/core/notifications/define";
export { defineNotification } from "~/core/notifications/define";

// Server-only: do not call from client code (reference only inside loaders/actions/server$).
export { db } from "~/core/db/connection";
export type { PaymentContext, PaymentHandlers } from "~/core/payments/payments";
export type { PublicUser } from "~/core/users/public-user";
export {
	publicUserColumns,
	publicUserSelect,
	publicUserThumbnailUrl,
	toPublicUser,
} from "~/core/users/public-user";
export { requireActiveModule } from "~/core/registry/manifests";
export { currentScope, currentScopeRest } from "~/core/router/scope-request";
export { adminUrl, scopeUrl } from "~/core/router/scope-path";
// Access layer: scope roles (inherited downward) and memberships (counting upward).
export type { MinRole, ScopeAccess, ScopeMember } from "~/core/scopes/access";
export {
	allowedVisibilities,
	canManageScope,
	canViewScope,
	currentUser,
	getAncestors,
	getDescendants,
	getRootScope,
	getScope,
	getSubtreeIds,
	isMember,
	isPlatformAdmin,
	isWithinScope,
	listManagedScopes,
	listMembers,
	requireScopeRole,
	requireWithinScope,
	scopeLabels,
} from "~/core/scopes/access";
// Listings of scoped content (spec 4.3): own + ancestors by visibility, public items from below.
export {
	type ContentFilter,
	localFirst,
	requestContentFilter,
	scopeContentFilter,
	scopeSourceLabels,
} from "~/core/scopes/content-filter";
export type { Scope } from "~/core/scopes/schema/scopes";
export { VISIBILITIES, type Visibility } from "~/core/scopes/visibility";
// Server-only core services for modules (memberships tiers, user tags). Tag *rule evaluation*
// is not core; it lives in the events module (`src/modules/events/services/tag-rules.ts`).
export { deleteS3Objects } from "~/core/media/image-processing.service";
export { membershipsService } from "~/core/memberships/memberships.service";
export { assertNoPrivateFields } from "~/core/shared/no-private-fields";
export { slugify, uniqueSlug } from "~/core/shared/slug";
export type { PageDirection } from "~/core/shared/pagination";
export {
	createCursorFromItem,
	decodeCursor,
	getNextCursorFromRows,
	paginateRows,
} from "~/core/shared/pagination";
export type { NotifyInput, NotifyRecipient } from "~/core/notifications/notify";
export { notify } from "~/core/notifications/notify";
export { userTagsService } from "~/core/tags/user-tags.service";
export { usersService } from "~/core/users/users.service";
export { deriveThumbnailKey, publicImageUrlFromKey } from "~/core/media/images";
export { sanitizeRichHtml } from "~/core/content/sanitize-html";
export {
	generatePresignedGetUrl,
	generateSecurePhotoUrl,
} from "~/core/media/secure-urls";
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
// Internal references (spec 4.3): never build or store item URLs by hand.
export {
	internalLinksToRefs,
	itemUrl,
	renderRichHtml,
	resolveRef,
	resolveRefs,
	withItemUrls,
} from "~/core/registry/refs";
export type { RefLocation, RefTypeDefinition } from "~/core/router/modules";
export {
	formatRef,
	itemRef,
	parseHumanRef,
	parseRef,
	refHref,
	scopeRef,
} from "~/core/refs/refs";

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

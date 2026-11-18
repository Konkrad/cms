import { pathFromAdminSegment } from "~/core/router/scope-path";
import {
	findUploadRule,
	isUnderPrefix,
	type ModuleUploadRule,
} from "~/core/router/uploads";
import {
	type AccessUser,
	canManageScope,
	isPlatformAdmin,
	listManagedScopes,
} from "~/core/scopes/access";
import { scopesService } from "~/core/scopes/scopes.service";

/** Core's own upload prefixes: profile pictures (any logged-in user, their own avatar). */
export const PROFILE_PICTURE_PREFIXES = [
	"private/profile-pictures/",
	"public/profile-pictures/",
] as const;

/**
 * Core's public content prefixes (scope home page images, article images, page-builder images):
 * a platform admin or anyone with a managing role on some scope.
 */
export const CORE_CONTENT_PREFIXES = [
	"public/scopes/",
	"public/articles/",
	"public/page-blocks/",
] as const;

export type UploadDecision = "allowed" | "forbidden" | "unknown-prefix";

/**
 * Whether `user` may upload to the (sanitized) path `prefix`. Core prefixes are core's; every
 * other path must lie under a prefix an ACTIVE module declares (`uploads`), and the uploader
 * needs that rule's `minRole` on the upload's scope: `scopeSegment` is the `[scope]` admin
 * segment of the page uploading (`germany.berlin`, sent by `ImageUploader` as
 * `x-upload-scope`). Without a scope, an unknown scope or the role: "forbidden". A path no rule
 * covers: "unknown-prefix" (an inactive module's prefixes included).
 */
export async function authorizeUpload(
	user: NonNullable<AccessUser>,
	prefix: string,
	scopeSegment: string | null,
	moduleRules: readonly ModuleUploadRule[],
): Promise<UploadDecision> {
	if (PROFILE_PICTURE_PREFIXES.some((p) => isUnderPrefix(prefix, p)))
		return "allowed";
	if (CORE_CONTENT_PREFIXES.some((p) => isUnderPrefix(prefix, p))) {
		if (await isPlatformAdmin(user)) return "allowed";
		return (await listManagedScopes(user)).length > 0 ? "allowed" : "forbidden";
	}
	const rule = findUploadRule(prefix, moduleRules);
	if (!rule) return "unknown-prefix";
	const path = scopeSegment ? pathFromAdminSegment(scopeSegment) : null;
	const scope = path ? await scopesService.getByPath(path) : undefined;
	if (!scope) return "forbidden";
	return (await canManageScope(user, scope.id, rule.minRole))
		? "allowed"
		: "forbidden";
}

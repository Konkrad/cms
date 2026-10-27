/**
 * Module upload prefixes (manifest `uploads`, spec 4.1, guide 5.14): the S3 key prefixes a module
 * uploads to through core's `/api/images`, and the minimum scope role an uploader needs on the
 * upload's scope. Pure: no app imports.
 */
import type { Role } from "~/core/scopes/scopes.service";

export interface UploadRule {
	/** S3 key prefix with a trailing slash: `public/<module id>/…` or `private/<module id>/…`. */
	prefix: string;
	/** Minimum role on the scope the upload is for (roles inherit downward). */
	minRole: Role;
}

export interface ModuleUploadRule extends UploadRule {
	module: string;
}

/**
 * The upload rules of the given modules. Throws when a prefix is not `public/<id>/` or
 * `private/<id>/` of its own module (optionally with sub folders), so a module can never claim
 * core's prefixes or another module's.
 */
export function moduleUploadRulesOf(
	modules: ReadonlyArray<{ id: string; uploads?: readonly UploadRule[] }>,
): ModuleUploadRule[] {
	return modules.flatMap((m) =>
		(m.uploads ?? []).map((rule) => {
			const own = new RegExp(
				`^(public|private)/${m.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([A-Za-z0-9_-][A-Za-z0-9._-]*/)*$`,
			);
			if (!own.test(rule.prefix))
				throw new Error(
					`Upload prefix "${rule.prefix}" of module ${m.id} must be public/${m.id}/… or private/${m.id}/… with a trailing slash`,
				);
			return { ...rule, module: m.id };
		}),
	);
}

/** Whether an upload path (`public/events/abc`, no trailing slash) lies under `prefix`. */
export const isUnderPrefix = (path: string, prefix: string): boolean =>
	`${path.replace(/\/+$/, "")}/`.startsWith(prefix);

/** The most specific rule whose prefix covers `path`, if any. */
export function findUploadRule<T extends UploadRule>(
	path: string,
	rules: readonly T[],
): T | undefined {
	return rules
		.filter((rule) => isUnderPrefix(path, rule.prefix))
		.sort((a, b) => b.prefix.length - a.prefix.length)[0];
}

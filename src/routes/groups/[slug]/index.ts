import type { RequestHandler } from "@qwik.dev/router";
import { scopeUrl } from "~/core/router/scope-path";
import { scopesService } from "~/core/scopes/scopes.service";

/**
 * Old group URLs (`/groups/<slug>`) moved to the scope's home page (`/germany/berlin`).
 * Redirects when exactly one scope has that slug; slugs are only unique among siblings, so
 * an ambiguous or unknown slug is a 404.
 */
export const onGet: RequestHandler = async ({ params, redirect, error }) => {
	const matches = await scopesService.findBySlug(params.slug);
	if (matches.length !== 1) throw error(404, "Not found");
	throw redirect(301, scopeUrl(matches[0].path));
};

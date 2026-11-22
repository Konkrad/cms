import type { RequestEventLoader } from "@qwik.dev/router";
import { getServerSession } from "~/core/auth/server-auth";
import { pagesService } from "~/core/content/pages.service";
import { renderBlockRefs } from "~/core/registry/refs";
import { canViewScope } from "~/core/scopes/access";
import type { Scope } from "~/core/scopes/schema/scopes";

/**
 * The published CMS page of `scope` at the URL remainder `rest` (after the scope prefix):
 * "/" is the root's home page, "/about" the page with slug "about". Null with a 404 status
 * when there is none (pages are one segment deep) or the viewer may not see it (a members-only
 * page, spec 4.2). Server only.
 */
export async function loadCmsPage(
	event: RequestEventLoader,
	scope: Scope | undefined,
	rest: string,
) {
	const slug = rest.replace(/^\/+|\/+$/g, "");
	const page =
		scope && !slug.includes("/")
			? await pagesService.getBySlug(scope.id, slug)
			: undefined;
	const visible =
		page?.status === "published" &&
		(page.visibility === "public" ||
			(await canViewScope(
				await getServerSession(event),
				page.scopeId,
				page.visibility,
			)));
	if (!page || !visible) {
		event.status(404);
		return null;
	}
	return {
		id: page.id,
		title: page.title,
		// Link fields and rich text: stored references become current URLs.
		content: await renderBlockRefs(page.content),
		updatedAt: page.updatedAt,
	};
}

import type { RequestEventLoader } from "@qwik.dev/router";
import { pagesService } from "~/core/content/pages.service";
import type { Scope } from "~/core/scopes/schema/scopes";

/**
 * The published CMS page of `scope` at the URL remainder `rest` (after the scope prefix):
 * "/" is the root's home page, "/about" the page with slug "about". Null with a 404 status
 * when there is none (pages are one segment deep). Server only.
 */
export async function loadCmsPage(
	{ status }: Pick<RequestEventLoader, "status">,
	scope: Scope | undefined,
	rest: string,
) {
	const slug = rest.replace(/^\/+|\/+$/g, "");
	const page =
		scope && !slug.includes("/")
			? await pagesService.getBySlug(scope.id, slug)
			: undefined;
	if (!page || page.status !== "published") {
		status(404);
		return null;
	}
	return {
		id: page.id,
		title: page.title,
		content: page.content,
		updatedAt: page.updatedAt,
	};
}

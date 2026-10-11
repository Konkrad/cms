import { pagesService } from "~/core/content/pages.service";
import { postsService } from "~/core/content/posts.service";
import type { ModuleDefinition } from "~/core/router/modules";
import { CORE_REF_MODULE } from "./refs";

/**
 * Core's own reference types, declared like a module's `refs`: `core:post:<id>` (served at
 * `<scope path>/posts/<id>`) and `core:page:<id>` (`<scope path>/<slug>`). Server-only.
 */
export const coreRefModule: Pick<ModuleDefinition, "id" | "refs"> = {
	id: CORE_REF_MODULE,
	refs: {
		post: {
			label: "Post",
			path: "/posts/:id",
			locate: (ids) => postsService.locate(ids),
			search: (query, limit) => postsService.searchPublic(query, limit),
		},
		page: {
			label: "Page",
			path: "/:slug",
			locate: (ids) => pagesService.locate(ids),
			async find(scopeId, slug) {
				return (await pagesService.getBySlug(scopeId, slug))?.id ?? null;
			},
			search: (query, limit) => pagesService.searchPublished(query, limit),
		},
	},
};

import { articlesService } from "~/core/content/articles.service";
import { notesService } from "~/core/content/notes.service";
import { pagesService } from "~/core/content/pages.service";
import type { ModuleDefinition } from "~/core/router/modules";
import { CORE_REF_MODULE } from "./refs";

/**
 * Core's own reference types, declared like a module's `refs`: `core:note:<id>` (served at
 * `<scope path>/notes/<id>`), `core:article:<id>` (`<scope path>/articles/<id>`) and
 * `core:page:<id>` (`<scope path>/<slug>`). Server-only.
 */
export const coreRefModule: Pick<ModuleDefinition, "id" | "refs"> = {
	id: CORE_REF_MODULE,
	refs: {
		note: {
			label: "Note",
			path: "/notes/:id",
			locate: (ids) => notesService.locate(ids),
			search: (query, limit) => notesService.searchPublic(query, limit),
		},
		article: {
			label: "Article",
			path: "/articles/:id",
			locate: (ids) => articlesService.locate(ids),
			search: (query, limit) => articlesService.searchPublic(query, limit),
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

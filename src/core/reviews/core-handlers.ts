import type { ReviewHandlers } from "~/core/reviews/define";

/**
 * Review handlers of core's own item types (`core:<type>:<id>`), by type. Notes and articles
 * are published on approval; a rejected one stays unpublished until its author saves it again
 * (which resubmits it). Lazy imports: the content services import the reviews module.
 */
export const coreReviewHandlers: Record<string, ReviewHandlers> = {
	note: {
		async onApproved(_ctx, { id }) {
			const { notesService } = await import("~/core/content/notes.service");
			await notesService.publish(id);
		},
		async onRejected() {},
	},
	article: {
		async onApproved(_ctx, { id }) {
			const { articlesService } = await import(
				"~/core/content/articles.service"
			);
			await articlesService.publish(id);
		},
		async onRejected() {},
	},
};

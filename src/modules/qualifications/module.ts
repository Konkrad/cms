import { defineModule, t } from "~/core";
import { qualificationsPages } from "./pages";
import { claimReview } from "./review";
import qualificationsSchema from "./schema";
import { qualificationsService } from "./service";

export const qualificationsModule = defineModule({
	id: "qualifications",
	schema: qualificationsSchema,
	pages: qualificationsPages,
	admin: {
		sections: [
			{
				path: "qualifications",
				label: t("qualifications.module.qualifications"),
				order: 210,
			},
		],
	},
	// Pending claims are approved in core's Reviews queue (review.ts).
	reviews: { claim: claimReview },
	// Statistics pages: who came / the members, by qualification held (one type per batch
	// gives a cohort breakdown).
	statistics: [
		{
			id: "qualifications.byType",
			title: () => t("qualifications.statistics.title"),
			count: (userIds) => qualificationsService.countHoldersByType(userIds),
		},
	],
	// Demo qualification types and user qualifications; lazy (dev dependencies stay out of the server).
	seed: async (ctx) => (await import("./seed")).seedQualifications(ctx),
});

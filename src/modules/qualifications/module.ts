import { defineModule, t } from "~/core";
import { qualificationsPages } from "./pages";

export const qualificationsModule = defineModule({
	id: "qualifications",
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
	// Demo qualification types and user qualifications; lazy (dev dependencies stay out of the server).
	seed: async (ctx) => (await import("./seed")).seedQualifications(ctx),
});

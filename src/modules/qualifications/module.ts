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
});

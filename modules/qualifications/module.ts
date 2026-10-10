import { defineModule } from "~/core-api";
import { qualificationsPages } from "./pages";

export const qualificationsModule = defineModule({
	id: "qualifications",
	pages: qualificationsPages,
	admin: {
		sections: [{ path: "qualifications", label: "Qualifications", order: 210 }],
	},
});

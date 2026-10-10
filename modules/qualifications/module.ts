import { defineModule } from "~/core";
import { qualificationsPages } from "./pages";

export const qualificationsModule = defineModule({
	id: "qualifications",
	pages: qualificationsPages,
	admin: {
		sections: [{ path: "qualifications", label: "Qualifications", order: 210 }],
	},
});

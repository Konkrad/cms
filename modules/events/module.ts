import { defineModule } from "~/core-api";
import { eventsBlocks } from "./blocks";

export const eventsModule = defineModule({
	id: "events",
	// Events are managed in every group's admin as well as the global one.
	admin: {
		sections: [{ path: "events", label: "Events", order: 30, scopes: "all" }],
	},
	blocks: eventsBlocks,
});

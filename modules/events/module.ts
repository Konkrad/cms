import { defineModule } from "~/core-api";
import { eventsBlocks } from "./blocks";

export const eventsModule = defineModule({
	id: "events",
	// Events are managed in every group's admin as well as the global one.
	admin: {
		sections: [{ path: "events", label: "Events", order: 30, scopes: "all" }],
	},
	blocks: eventsBlocks,
	// Lazy: the fulfilment graph (Stripe client, QR, iCal, email) would otherwise load with the
	// manifest and form an import cycle through ~/core-api (stripe.ts reads env at load time).
	payments: {
		tickets: {
			onPaid: async (ctx) => (await import("./payments")).onTicketsPaid(ctx),
		},
	},
});

import { component$, useStore } from "@qwik.dev/core";
import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireModuleAuth } from "~/core-api";
import PurchaseList from "~theme/routes/profile/PurchaseList";
import QrTicketWall from "~theme/routes/profile/QrTicketWall";
import type { UserDashboardData } from "./profile-tickets-data";
import { participantsService } from "./services/participants";
import { ticketsService } from "./services/tickets";

const slotsSchema = z.array(z.object({ name: z.string(), email: z.string() }));

export const useUpdateParticipants = routeAction$(
	async (input, event) => {
		const userData = await requireModuleAuth(event, "events");

		// Verify the user owns this ticket
		const ticket = await ticketsService.getById(input.ticketId);
		if (!ticket || ticket.buyerId !== userData.id) {
			return { failed: true, message: "Ticket not found" };
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(input.slots);
		} catch {
			return { failed: true, message: "Invalid participants" };
		}
		const result = slotsSchema.safeParse(parsed);
		if (!result.success) {
			return { failed: true, message: "Invalid participants" };
		}
		const slots = result.data;

		await participantsService.replaceForTicket(input.ticketId, slots);
		// Rotate the QR code UUID so the old QR image is invalidated
		const updated = await ticketsService.rotateQrCode(input.ticketId);
		return { success: true, newQrCodeUuid: updated?.qrCodeUuid ?? null };
	},
	zod$({
		ticketId: z.string(),
		/** JSON-encoded array of { name, email } */
		slots: z.string(),
	}),
);

type Props = { dashboard: UserDashboardData };

export const ProfileTickets = component$<Props>(({ dashboard }) => {
	const updateParticipants = useUpdateParticipants();
	const qrBust = useStore<Record<string, string>>({});

	return (
		<div class="max-w-2xl mx-auto px-4 py-8">
			<div class="mb-8">
				<h1 class="text-3xl font-bold mb-2">My Tickets & Purchases</h1>
				<p class="text-gray-600">View your tickets and manage your purchases</p>
			</div>

			<div class="space-y-8">
				<QrTicketWall
					tickets={dashboard.myQrTickets}
					buyerUserId={dashboard.buyerUserId}
					qrBust={qrBust}
				/>
				<PurchaseList
					transactions={dashboard.transactions}
					buyerUserId={dashboard.buyerUserId}
					updateParticipantsAction={updateParticipants}
					qrBust={qrBust}
				/>
			</div>
		</div>
	);
});

import { component$, useStore } from "@qwik.dev/core";
import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireModuleAuth, usersService } from "~/core";
import { t } from "~/core/ui";
import PurchaseList from "~theme/routes/profile/PurchaseList";
import QrTicketWall from "~theme/routes/profile/QrTicketWall";
import type { UserDashboardData } from "./profile-tickets-data";
import { participantsService } from "./services/participants";
import { ticketsService } from "./services/tickets";

const slotsSchema = z.array(
	z.object({
		name: z.string(),
		email: z.string(),
		/** Keep this existing participant of the ticket (its email never left the server). */
		participantId: z.string().nullish(),
		/** A member picked from the directory; their email is resolved server-side. */
		existingUserId: z.string().nullish(),
	}),
);

export const useUpdateParticipants = routeAction$(
	async (input, event) => {
		const userData = await requireModuleAuth(event, "events");

		// Verify the user owns this ticket
		const ticket = await ticketsService.getById(input.ticketId);
		if (!ticket || ticket.buyerId !== userData.id) {
			return {
				failed: true,
				message: t("events.profileTickets.ticketNotFound"),
			};
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(input.slots);
		} catch {
			return {
				failed: true,
				message: t("events.profileTickets.invalidParticipants"),
			};
		}
		const result = slotsSchema.safeParse(parsed);
		if (!result.success) {
			return {
				failed: true,
				message: t("events.profileTickets.invalidParticipants"),
			};
		}
		// Emails are not round-tripped through the page: resolve them here from the
		// ticket's existing participants or from the picked member's id.
		const existing = new Map(ticket.participants.map((p) => [p.id, p]));
		const pickedEmails = await usersService.getEmailsByIds(
			result.data.flatMap((s) =>
				!s.email.trim() && s.existingUserId ? [s.existingUserId] : [],
			),
		);
		const slots = result.data.map((s) => {
			if (s.email.trim()) return { name: s.name, email: s.email };
			const kept = s.participantId ? existing.get(s.participantId) : undefined;
			const email =
				kept?.email ??
				(s.existingUserId ? pickedEmails.get(s.existingUserId) : undefined) ??
				"";
			return { name: s.name, email };
		});

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
				<h1 class="text-3xl font-bold mb-2">
					{t("events.profileTickets.myTicketsPurchases")}
				</h1>
				<p class="text-gray-600">
					{t("events.profileTickets.viewYourTicketsAndManage")}
				</p>
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

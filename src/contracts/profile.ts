/**
 * Core → theme data contract for the profile page (`/profile`) and its
 * in-place editing actions.
 */

import type { ticketsService } from "~/modules/events/services/tickets";
import type {
	useUpdateDetails,
	useUpdateLocation,
	useUpdateName,
	useUpdatePicture,
} from "~/routes/profile";
import type {
	useUpdateParticipants,
	useUserDashboard,
} from "~/routes/profile/tickets";

export type UpdateNameAction = ReturnType<typeof useUpdateName>;
export type UpdateLocationAction = ReturnType<typeof useUpdateLocation>;
export type UpdatePictureAction = ReturnType<typeof useUpdatePicture>;
export type UpdateDetailsAction = ReturnType<typeof useUpdateDetails>;

/** Core → theme data contract for `/profile/tickets`. */
export type UserDashboardData = ReturnType<typeof useUserDashboard>["value"];
export type UpdateParticipantsAction = ReturnType<typeof useUpdateParticipants>;

/** Ticket with its event/product/participants relations, as returned by ticketsService/participantsService. */
export type TicketWithRelations = Awaited<
	ReturnType<typeof ticketsService.getByBuyerId>
>[number];

/** Transaction with its event, line items, and attached tickets — shape built by the `/profile/tickets` loader. */
export type TransactionWithTickets = UserDashboardData["transactions"][number];

/** One application inside an election-history group on a profile. */
export interface ProfileElectionApplication {
	id: string;
	status: string;
	position: { title: string };
}

/** One event a profile owner takes part in. */
export interface ProfileEventEntry {
	id: string;
	/** Canonical URL under the owning scope. */
	url: string;
	title: string;
	startDate: string;
	endDate: string;
	city: string | null;
	country: string | null;
}

/** One election cycle with the owner's applications (elections module, own profile only). */
export interface ProfileElectionGroup {
	title: string;
	year: number;
	apps: ProfileElectionApplication[];
}

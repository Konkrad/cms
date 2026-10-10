/**
 * Core → theme data contract for the profile page (`/profile`) and its
 * in-place editing actions.
 */
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
import type { ticketsService } from "~modules/events/services/tickets";

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

/**
 * Sections that active modules add to the profile pages (`/profile`, `/users/[userId]`).
 * One optional field per contributed section, named after what the theme renders; the pages
 * merge the `profile` hook results of all active modules into their loader output. Contribute
 * only what the viewer may see: the hook gets `isOwnProfile` and must strip anything private.
 */
export interface ProfileExtras {
	/** Election applications grouped by cycle, newest year first (own profile only). */
	electionGroups?: {
		title: string;
		year: number;
		apps: ProfileElectionApplication[];
	}[];
}

import type { RequestEventLoader } from "@qwik.dev/router";
import { participationService } from "../services/participation";
import { requireAdminEvent } from "./event-guards";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminParticipation(event: RequestEventLoader) {
	const { event: target } = await requireAdminEvent(event);
	const [summary, details] = await Promise.all([
		participationService.getSummary(target.id),
		participationService.getByEventIdWithEmailsAndRequirementValues(target.id),
	]);
	return {
		event: { id: target.id, title: target.title },
		participationData: { summary, details },
	};
}

export type AdminParticipationData = Awaited<
	ReturnType<typeof loadAdminParticipation>
>;

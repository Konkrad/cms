import type { ElectionCandidate } from "~/contracts/elections";
import { toPublicUser } from "~/core";
import type { ElectionApplicationPublic } from "./service";

/**
 * Approved applicant as shown on the public cycle page: only what the page renders.
 */
export function toPublicCandidate(
	app: ElectionApplicationPublic,
): ElectionCandidate {
	return {
		id: app.id,
		positionId: app.positionId,
		motivationWhy: app.motivationWhy,
		motivationExperience: app.motivationExperience,
		motivationGoals: app.motivationGoals,
		user: toPublicUser(app.user),
	};
}

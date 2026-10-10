import type { ElectionApplicationPublic } from "./service";

/**
 * Approved applicant as shown on the public cycle page. The service row carries the applicant's
 * whole `users` row (demographics, consent, login id); only what the page renders may be serialized.
 */
export function toPublicCandidate(app: ElectionApplicationPublic) {
	return {
		id: app.id,
		positionId: app.positionId,
		motivationWhy: app.motivationWhy,
		motivationExperience: app.motivationExperience,
		motivationGoals: app.motivationGoals,
		user: {
			id: app.user.id,
			name: app.user.name,
			familyName: app.user.familyName,
		},
	};
}

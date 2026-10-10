/**
 * Core → theme data contract for the public user profile route (`/users/[userId]`).
 * Declared, not derived from the loader: this page shows ANOTHER user's data, so
 * every field that reaches it is listed here.
 */
import type { ProfileEventEntry, ProfileExtras } from "~/contracts/profile";

export type PublicProfileViewData =
	| (ProfileExtras & {
			name: string;
			familyName: string;
			city: string | null;
			country: string | null;
			/** Public thumbnail URL (never the private full-size picture). */
			profilePictureUrl: string | null;
			tags: { id: string; label: string }[];
			communities: { name: string; slug: string }[];
			upcomingEvents: ProfileEventEntry[];
			pastEvents: ProfileEventEntry[];
			isOwner: boolean;
			/** Owner only: the viewer's own login email, birth year and gender. */
			email?: string | null;
			yearOfBirth?: number | null;
			sex?: string | null;
			/** Answers of the onboarding (affiliation) form. */
			affiliationEntries: { question: string; answer: string }[];
			/** Owner only: the viewer's own form submissions. */
			submittedForms?: {
				id: string;
				title: string;
				submittedAt: string;
				path: string;
				responseEntries: { question: string; answer: string }[];
			}[];
	  })
	| null;

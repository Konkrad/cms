/**
 * Core → theme data contract for the public user profile route (`/users/[userId]`).
 * Declared, not derived from the loader: this page shows ANOTHER user's data, so
 * every field that reaches it is listed here.
 */

export type PublicProfileViewData = {
	/** The profile's user id (props of the `userPage.sections` slot). */
	id: string;
	name: string;
	familyName: string;
	city: string | null;
	country: string | null;
	/** Public thumbnail URL (never the private full-size picture). */
	profilePictureUrl: string | null;
	tags: { id: string; label: string }[];
	communities: { name: string; url: string }[];
	isOwner: boolean;
	/** Owner only: the viewer's own login email, birth period and gender. */
	email?: string | null;
	birthPeriod?: BirthPeriodChoice | null;
	/** Owner only: the periods to choose from (the site's period length). */
	birthPeriodOptions?: BirthPeriodChoice[];
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
} | null;

/** A birth period (e.g. 1990–1994): its first year, as stored, and its label. */
export interface BirthPeriodChoice {
	value: number;
	label: string;
}

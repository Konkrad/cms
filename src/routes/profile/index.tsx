import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { groupMemberships } from "~/db/schemas/group-memberships";
import { groups } from "~/db/schemas/groups";
import { env } from "~/env";
import { electionsService } from "~/services/elections.service";
import { formResultsService } from "~/services/form-results.service";
import { userTagsService } from "~/services/user-tags.service";
import { formatAffiliationResultJson } from "~/utils/affiliation";
import { buildFormPath } from "~/utils/forms";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/utils/images";
import { getCurrentUserData, requireAuth } from "~/utils/server-auth";
import { UserProfile } from "~theme/routes/profile/UserProfile/UserProfile";
import { useUpdateDetails } from "../../components/profile/useUpdateDetails";
import { useUpdateLocation } from "../../components/profile/useUpdateLocation";
// Import via a RELATIVE path, not "~" — qwikRouter's production transform
// for re-exported routeAction$/routeLoader$ does not resolve either tsconfig
// alias, so the Rollup build fails to find the module. See useUpdateName.ts.
import { useUpdateName } from "../../components/profile/useUpdateName";
import { useUpdatePicture } from "../../components/profile/useUpdatePicture";

// Re-export so Qwik City registers the actions for this route.
export { useUpdateName, useUpdateLocation, useUpdatePicture, useUpdateDetails };

export const useProfile = routeLoader$(async (event) => {
	await requireAuth(event);
	const userData = await getCurrentUserData(event);

	if (!userData) {
		throw event.redirect(302, "/login");
	}

	const user = userData as any;

	const profilePictureUrl = user.profilePicture
		? publicImageUrlFromKey(
				user.profilePictureSmall ?? deriveThumbnailKey(user.profilePicture),
				env.S3_BASE_URL,
			)
		: null;

	const { participationService } = await import(
		"~/services/participation.service"
	);

	const [submittedForms, tags, electionApplications, communityRows, events] =
		await Promise.all([
			formResultsService.getByUser(user.id),
			userTagsService.getByUser(user.id),
			electionsService.getApplicationsByUser(user.id),
			db
				.select({ name: groups.name, slug: groups.slug })
				.from(groupMemberships)
				.innerJoin(groups, eq(groupMemberships.groupId, groups.id))
				.where(eq(groupMemberships.userId, user.id)),
			participationService.getByUserId(user.id),
		]);

	const electionsByCycle = new Map<
		string,
		{ title: string; year: number; apps: typeof electionApplications }
	>();
	for (const app of electionApplications) {
		if (!electionsByCycle.has(app.cycleId)) {
			electionsByCycle.set(app.cycleId, {
				title: app.cycle.title,
				year: app.cycle.year,
				apps: [],
			});
		}
		electionsByCycle.get(app.cycleId)!.apps.push(app);
	}

	return {
		name: user.name as string,
		familyName: user.familyName as string,
		role: user.role as string,
		city: user.city ?? null,
		country: user.country ?? null,
		profilePictureUrl,
		tags: tags.map((t) => ({ id: t.id, label: t.label })),
		communities: communityRows,
		upcomingEvents: events.upcoming,
		pastEvents: events.past,
		isOwner: true,
		email: (user.email as string | null) ?? null,
		yearOfBirth: user.yearOfBirth ?? null,
		sex: user.sex ?? null,
		electionGroups: [...electionsByCycle.values()]
			.sort((a, b) => b.year - a.year)
			.map((g) => ({
				...g,
				apps: g.apps.map((a) => ({
					id: a.id,
					status: a.status,
					position: (a as any).position ?? null,
				})),
			})),
		affiliationEntries: (() => {
			const onboarding = submittedForms.find(
				(s) => s.formSlug === "onboarding",
			);
			return onboarding
				? formatAffiliationResultJson(onboarding.resultJson || {})
				: [];
		})(),
		affiliationEditPath: (() => {
			const onboarding = submittedForms.find(
				(s) => s.formSlug === "onboarding",
			);
			return onboarding
				? buildFormPath({ id: onboarding.formId, slug: onboarding.formSlug })
				: null;
		})(),
		// The onboarding form's academic-path data is already shown, nicely
		// formatted, as the "Relations / Affiliation" section above (see
		// affiliationEntries) — don't also list it as a raw generic submission.
		submittedForms: submittedForms
			.filter((s) => s.formSlug !== "onboarding")
			.map((s) => ({
				id: s.id,
				title: s.formTitle,
				submittedAt: s.submittedAt,
				path: buildFormPath({ id: s.formId, slug: s.formSlug }),
			})),
	};
});

export default component$(() => {
	const profile = useProfile();
	const updateNameAction = useUpdateName();
	const updateLocationAction = useUpdateLocation();
	const updatePictureAction = useUpdatePicture();
	const updateDetailsAction = useUpdateDetails();
	return (
		<UserProfile
			{...profile.value}
			updateNameAction={updateNameAction}
			updateLocationAction={updateLocationAction}
			updatePictureAction={updatePictureAction}
			updateDetailsAction={updateDetailsAction}
		/>
	);
});

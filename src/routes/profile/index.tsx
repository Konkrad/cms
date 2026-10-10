import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { eq } from "drizzle-orm";
import { db } from "~/core/db/connection";
import { groupMemberships } from "~/db/schemas/group-memberships";
import { groups } from "~/db/schemas/groups";
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
import { activeProfileExtras } from "../../core/registry/manifests";

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
			)
		: null;

	const [submittedForms, tags, extras, communityRows] = await Promise.all([
		formResultsService.getByUser(user.id),
		userTagsService.getByUser(user.id),
		activeProfileExtras({
			userId: user.id,
			viewerId: user.id,
			isOwnProfile: true,
		}),
		db
			.select({ name: groups.name, slug: groups.slug })
			.from(groupMemberships)
			.innerJoin(groups, eq(groupMemberships.groupId, groups.id))
			.where(eq(groupMemberships.userId, user.id)),
	]);

	return {
		...extras,
		name: user.name as string,
		familyName: user.familyName as string,
		role: user.role as string,
		city: user.city ?? null,
		country: user.country ?? null,
		profilePictureUrl,
		tags: tags.map((t) => ({ id: t.id, label: t.label })),
		communities: communityRows,
		// Sections of modules that are not active fall back to empty.
		upcomingEvents: extras.upcomingEvents ?? [],
		pastEvents: extras.pastEvents ?? [],
		isOwner: true,
		email: (user.email as string | null) ?? null,
		yearOfBirth: user.yearOfBirth ?? null,
		sex: user.sex ?? null,
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

import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { getCurrentUserData, requireAuth } from "~/core/auth/server-auth";
import { formResultsService } from "~/core/forms/form-results.service";
import { buildFormPath } from "~/core/forms/forms";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/core/media/images";
import { groupMembershipsService } from "~/core/scopes/group-memberships.service";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { userTagsService } from "~/core/tags/user-tags.service";
import { formatAffiliationResultJson } from "~/core/users/affiliation";
import { UserProfile } from "~theme/routes/profile/UserProfile/UserProfile";
import { activeProfileExtras } from "../../core/registry/manifests";
import { useUpdateDetails } from "../../core/users/profile/useUpdateDetails";
import { useUpdateLocation } from "../../core/users/profile/useUpdateLocation";
// Import via a RELATIVE path, not "~" — qwikRouter's production transform
// for re-exported routeAction$/routeLoader$ does not resolve either tsconfig
// alias, so the Rollup build fails to find the module. See useUpdateName.ts.
import { useUpdateName } from "../../core/users/profile/useUpdateName";
import { useUpdatePicture } from "../../core/users/profile/useUpdatePicture";

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

	const [submittedForms, tags, extras, userGroups] = await Promise.all([
		formResultsService.getByUser(user.id),
		userTagsService.getByUser(user.id),
		activeProfileExtras({
			userId: user.id,
			viewerId: user.id,
			isOwnProfile: true,
		}),
		groupMembershipsService.getUserGroups(user.id),
	]);

	return assertNoPrivateFields(
		{
			...extras,
			name: user.name as string,
			familyName: user.familyName as string,
			city: user.city ?? null,
			country: user.country ?? null,
			profilePictureUrl,
			tags: tags.map((t) => ({ id: t.id, label: t.label })),
			communities: userGroups.map((g) => ({ name: g.name, slug: g.slug })),
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
		},
		{
			// The viewer's OWN profile: their login email, birth year and gender are theirs to see.
			allow: ["email", "yearOfBirth", "sex"],
		},
	);
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

import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import type { PublicProfileViewData } from "~/contracts/users";
import { getCurrentUserData, requireAuth } from "~/core/auth/server-auth";
import { formResultsService } from "~/core/forms/form-results.service";
import { buildFormPath } from "~/core/forms/forms";
import { scopeUrl } from "~/core/router/scope-path";
import { scopesService } from "~/core/scopes/scopes.service";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { formatAffiliationResultJson } from "~/core/users/affiliation";
import { usersService } from "~/core/users/users.service";
import { PublicProfileView } from "~theme/routes/users/PublicProfileView";
import { activeProfileExtras } from "../../../core/registry/manifests";

export const usePublicProfile = routeLoader$(
	async (event): Promise<PublicProfileViewData> => {
		await requireAuth(event);

		const uuid = event.params.userId.substring(0, 36);
		const user = await usersService.getPublicProfile(uuid);

		if (!user) {
			event.status(404);
			return null;
		}

		const currentUser = await getCurrentUserData(event);
		const isOwner = currentUser?.id === user.id;

		// The owner's own private details; never loaded for another viewer.
		const ownDetails = isOwner
			? await usersService.getOwnPrivateDetails(user.id)
			: null;

		const { userTagsService } = await import("~/core/tags/user-tags.service");
		const [groups, tags, submittedFormRows, extras] = await Promise.all([
			scopesService.listUserScopes(user.id),
			userTagsService.getByUser(user.id),
			formResultsService.getByUser(user.id),
			activeProfileExtras({
				userId: user.id,
				viewerId: currentUser?.id ?? null,
				isOwnProfile: isOwner,
			}),
		]);

		const formatResponseValue = (value: unknown): string => {
			if (value === null || value === undefined) return "-";
			if (typeof value === "string") return value.trim() || "-";
			if (typeof value === "number" || typeof value === "boolean")
				return String(value);
			if (Array.isArray(value)) {
				const parts = value
					.map((item) => {
						if (typeof item === "string") return item.trim();
						if (typeof item === "object" && item !== null) {
							return Object.entries(item as Record<string, unknown>)
								.filter(([, v]) => v !== null && v !== undefined && v !== "")
								.map(([k, v]) => `${k}: ${String(v)}`)
								.join(", ");
						}
						return String(item);
					})
					.filter(Boolean);
				return parts.length > 0 ? parts.join("; ") : "-";
			}
			return JSON.stringify(value);
		};

		return assertNoPrivateFields(
			{
				...extras,
				name: user.name,
				familyName: user.familyName,
				city: user.city,
				country: user.country,
				profilePictureUrl: user.profilePictureSmallUrl,
				tags: tags.map((t) => ({ id: t.id, label: t.label })),
				communities: groups.map((g) => ({
					name: g.name,
					url: scopeUrl(g.path),
				})),
				// Sections of modules that are not active fall back to empty.
				upcomingEvents: extras.upcomingEvents ?? [],
				pastEvents: extras.pastEvents ?? [],
				isOwner,
				...(ownDetails ?? {}),
				affiliationEntries: (() => {
					const onboarding = submittedFormRows.find(
						(s) => s.formSlug === "onboarding",
					);
					return onboarding
						? formatAffiliationResultJson(onboarding.resultJson || {})
						: [];
				})(),
				submittedForms: isOwner
					? submittedFormRows.map((s) => ({
							id: s.id,
							title: s.formTitle,
							submittedAt: s.submittedAt,
							path: buildFormPath({ id: s.formId, slug: s.formSlug }),
							responseEntries: Object.entries(s.resultJson || {}).map(
								([question, value]) => ({
									question,
									answer: formatResponseValue(value),
								}),
							),
						}))
					: undefined,
			},
			{
				// Owner only: the viewer's own email, birth year and gender (never another user's).
				allow: isOwner ? ["email", "yearOfBirth", "sex"] : [],
			},
		);
	},
);

export default component$(() => {
	const data = usePublicProfile();
	return <PublicProfileView data={data.value} />;
});

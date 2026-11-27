import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import type { PublicProfileViewData } from "~/contracts/users";
import { getCurrentUserData, requireAuth } from "~/core/auth/server-auth";
import { formResultsService } from "~/core/forms/form-results.service";
import { buildFormPath } from "~/core/forms/forms";
import { ONBOARDING_PURPOSE } from "~/core/forms/purposes";
import { scopeUrl } from "~/core/router/scope-path";
import { scopesService } from "~/core/scopes/scopes.service";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { formatAffiliationResultJson } from "~/core/users/affiliation";
import { ownBirthPeriod } from "~/core/users/own-birth-period";
import { usersService } from "~/core/users/users.service";
import { PublicProfileView } from "~theme/routes/users/PublicProfileView";
import { ModuleSlot } from "../../../core/registry/ModuleSlot";

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
		const [groups, tags, submittedFormRows] = await Promise.all([
			scopesService.listUserScopes(user.id),
			userTagsService.getByUser(user.id),
			formResultsService.getByUser(user.id),
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
				id: user.id,
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
				isOwner,
				...(ownDetails
					? {
							email: ownDetails.email,
							sex: ownDetails.sex,
							...ownBirthPeriod(ownDetails.birthPeriod),
						}
					: {}),
				affiliationEntries: (() => {
					const onboarding = submittedFormRows.find(
						(s) => s.formPurpose === ONBOARDING_PURPOSE,
					);
					return onboarding
						? formatAffiliationResultJson(onboarding.answers || {})
						: [];
				})(),
				submittedForms: isOwner
					? submittedFormRows.map((s) => ({
							id: s.id,
							title: s.formTitle,
							submittedAt: s.createdAt,
							path: buildFormPath({ id: s.formId, slug: s.formSlug }),
							responseEntries: Object.entries(s.answers || {}).map(
								([question, value]) => ({
									question,
									answer: formatResponseValue(value),
								}),
							),
						}))
					: undefined,
			},
			{
				// Owner only: the viewer's own email, birth period and gender (never another user's).
				allow: isOwner ? ["email", "birthPeriod", "sex"] : [],
			},
		);
	},
);

export default component$(() => {
	const data = usePublicProfile();
	const userId = data.value?.id;
	return (
		<PublicProfileView data={data.value}>
			{userId && (
				<ModuleSlot
					q:slot="sections"
					name="userPage.sections"
					props={{ userId }}
				/>
			)}
		</PublicProfileView>
	);
});

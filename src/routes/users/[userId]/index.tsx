import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { eq } from "drizzle-orm";
import { logins } from "~/core/auth/schema/logins";
import { getCurrentUserData, requireAuth } from "~/core/auth/server-auth";
import { db } from "~/core/db/connection";
import { groupMembershipsService } from "~/core/scopes/group-memberships.service";
import { formatAffiliationResultJson } from "~/core/users/affiliation";
import { usersService } from "~/core/users/users.service";
import { formResultsService } from "~/services/form-results.service";
import { buildFormPath } from "~/utils/forms";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/utils/images";
import { PublicProfileView } from "~theme/routes/users/PublicProfileView";
import { activeProfileExtras } from "../../../core/registry/manifests";

export const usePublicProfile = routeLoader$(async (event) => {
	await requireAuth(event);

	const uuid = event.params.userId.substring(0, 36);
	const user = await usersService.getById(uuid);

	if (!user) {
		event.status(404);
		return null;
	}

	const currentUser = await getCurrentUserData(event);
	const isOwner = currentUser?.id === user.id;

	let email: string | null = null;
	if (isOwner && user.loginId) {
		const [row] = await db
			.select()
			.from(logins)
			.where(eq(logins.id, user.loginId));
		if (row?.email) email = row.email;
	}

	const buildPicUrl = (key: string | null) => publicImageUrlFromKey(key);

	const isAdmin = currentUser?.role === "admin";

	const { userTagsService } = await import("~/core/tags/user-tags.service");
	const [groups, tags, submittedFormRows, extras] = await Promise.all([
		groupMembershipsService.getUserGroups(user.id),
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

	return {
		...extras,
		name: user.name,
		familyName: user.familyName,
		role: user.role,
		city: user.city ?? null,
		country: user.country ?? null,
		profilePictureUrl: buildPicUrl(
			user.profilePicture
				? ((user as any).profilePictureSmall ??
						deriveThumbnailKey(user.profilePicture))
				: null,
		),
		tags: tags.map((t) => ({ id: t.id, label: t.label })),
		communities: groups.map((g) => ({ name: g.name, slug: g.slug })),
		// Sections of modules that are not active fall back to empty.
		upcomingEvents: extras.upcomingEvents ?? [],
		pastEvents: extras.pastEvents ?? [],
		isOwner,
		email: isOwner ? email : null,
		yearOfBirth: isOwner ? (user.yearOfBirth ?? null) : null,
		sex: isOwner ? (user.sex ?? null) : null,
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
	};
});

export default component$(() => {
	const data = usePublicProfile();
	return <PublicProfileView data={data.value} />;
});

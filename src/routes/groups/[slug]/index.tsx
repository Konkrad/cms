import { component$ } from "@qwik.dev/core";
import {
	type DocumentHead,
	routeAction$,
	routeLoader$,
} from "@qwik.dev/router";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { groupMemberships, users } from "~/db/schema";
import { eventsService } from "~/services/events.service";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { groupRepresentativesService } from "~/services/group-representatives.service";
import { groupsService } from "~/services/groups.service";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/utils/images";
import { canonicalUrl } from "~/utils/seo";
import { getCurrentUserData } from "~/utils/server-auth";
import { buildProfileUrl } from "~/utils/users";
import { GroupView } from "~theme/routes/groups/GroupView";

export const useGroupData = routeLoader$(async (event) => {
	const { params, redirect } = event;
	const group = await groupsService.getBySlug(params.slug);
	if (!group) throw redirect(302, "/groups");

	const user = await getCurrentUserData(event);
	const now = new Date().toISOString();

	const [
		memberCount,
		pastEventCount,
		rep,
		isMember,
		recentMembers,
		upcomingEvents,
		recentPosts,
	] = await Promise.all([
		groupMembershipsService.countByGroupId(group.id),
		eventsService.countPastByGroupId(group.id),
		groupRepresentativesService.getFirstRepresentativeWithUser(group.id),
		user ? groupMembershipsService.isMember(user.id, group.id) : false,
		db
			.select({
				id: users.id,
				name: users.name,
				familyName: users.familyName,
				profilePicture: users.profilePicture,
				profilePictureSmall: users.profilePictureSmall,
			})
			.from(groupMemberships)
			.innerJoin(users, eq(groupMemberships.userId, users.id))
			.where(eq(groupMemberships.groupId, group.id))
			.limit(6),
		db.query.events.findMany({
			where: {
				groupId: group.id,
				deletedAt: { isNull: true },
				endDate: { gte: now },
			},
			orderBy: { startDate: "asc" },
			limit: 3,
		}),
		db.query.posts.findMany({
			with: { user: true },
			where: {
				groupId: group.id,
				deletedAt: { isNull: true },
			},
			orderBy: { createdAt: "desc" },
			limit: 3,
		}) as unknown as Promise<
			Array<{
				id: string;
				title: string;
				body: string;
				createdAt: string;
				featuredImage: string | null;
				user: { name: string; familyName: string };
			}>
		>,
	]);

	const toPublicUrl = (key: string | null | undefined) =>
		publicImageUrlFromKey(key);

	const repData = rep
		? {
				name: `${rep.user.name} ${rep.user.familyName}`,
				subtitle: `Local Rep ${group.name}`,
				profilePictureUrl: rep.user.profilePicture
					? toPublicUrl(
							(rep.user as { profilePictureSmall?: string | null })
								.profilePictureSmall ??
								deriveThumbnailKey(rep.user.profilePicture),
						)
					: null,
				profileUrl: buildProfileUrl({
					id: rep.userId,
					name: rep.user.name,
					familyName: rep.user.familyName,
				}),
			}
		: null;

	return {
		group,
		memberCount,
		pastEventCount,
		recentMembers: recentMembers.map((m) => ({
			id: m.id,
			name: m.name,
			familyName: m.familyName,
			profilePictureSmall: m.profilePicture
				? toPublicUrl(
						(m as { profilePictureSmall?: string | null })
							.profilePictureSmall ?? deriveThumbnailKey(m.profilePicture),
					)
				: null,
			profileUrl: buildProfileUrl({
				id: m.id,
				name: m.name,
				familyName: m.familyName,
			}),
		})),
		rep: repData,
		isMember,
		isLoggedIn: !!user,
		upcomingEvents: upcomingEvents.map((e) => ({
			id: e.id,
			title: e.title,
			startDate: e.startDate,
			endDate: e.endDate,
			image1: toPublicUrl(e.image1),
			locationType: e.locationType,
			city: e.city,
			address: e.address,
		})),
		recentPosts: recentPosts.map((p) => ({
			id: p.id,
			title: p.title,
			body: p.body,
			createdAt: p.createdAt,
			featuredImage: toPublicUrl(p.featuredImage ?? null),
			authorName: `${p.user.name} ${p.user.familyName}`,
		})),
		groupImage1: toPublicUrl(group.image1),
		groupImage2: toPublicUrl(group.image2),
		groupImage3: toPublicUrl(group.image3),
	};
});

export const useJoinGroup = routeAction$(async (_data, event) => {
	const { params, redirect } = event;
	const user = await getCurrentUserData(event);
	if (!user) throw redirect(302, "/login");

	const group = await groupsService.getBySlug(params.slug);
	if (!group) return { success: false, error: "Group not found" };

	await groupMembershipsService.join(user.id, group.id);
	return { success: true };
});

export default component$(() => {
	const data = useGroupData();
	const joinAction = useJoinGroup();
	return <GroupView data={data.value} joinAction={joinAction} />;
});

export const head: DocumentHead = ({ resolveValue, url }) => {
	try {
		const data = resolveValue(useGroupData);
		const canonical = canonicalUrl(url.pathname, url.origin);
		const description = `${data.group.name} — ${data.memberCount} members. Join the local community group.`;

		return {
			title: data.group.name,
			meta: [
				{ name: "description", content: description },
				{ property: "og:type", content: "website" },
				{ property: "og:title", content: data.group.name },
				{ property: "og:description", content: description },
				{ property: "og:url", content: canonical },
				...(data.groupImage1
					? [{ property: "og:image", content: data.groupImage1 }]
					: []),
			],
			links: [{ rel: "canonical", href: canonical }],
		};
	} catch {
		return { title: "Community Hub" };
	}
};

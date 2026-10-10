import { component$ } from "@qwik.dev/core";
import {
	type DocumentHead,
	routeAction$,
	routeLoader$,
} from "@qwik.dev/router";
import { getCurrentUserData } from "~/core/auth/server-auth";
import { postsService } from "~/core/content/posts.service";
import { canonicalUrl } from "~/core/content/seo";
import { publicImageUrlFromKey } from "~/core/media/images";
import { groupMembershipsService } from "~/core/scopes/group-memberships.service";
import { groupRepresentativesService } from "~/core/scopes/group-representatives.service";
import { groupsService } from "~/core/scopes/groups.service";
import { buildProfileUrl } from "~/core/users/format";
import { GroupView } from "~theme/routes/groups/GroupView";
import { activeGroupExtras } from "../../../core/registry/manifests";

export const useGroupData = routeLoader$(async (event) => {
	const { params, redirect } = event;
	const group = await groupsService.getBySlug(params.slug);
	if (!group) throw redirect(302, "/groups");

	const user = await getCurrentUserData(event);
	const [isMember, isRep] = user
		? await Promise.all([
				groupMembershipsService.isMember(user.id, group.id),
				groupRepresentativesService.isRepresentative(user.id, group.id),
			])
		: [false, false];
	// Group-only posts are for the group's members and representatives (and admins).
	const canSeeGroupOnly = isMember || isRep || user?.role === "admin";

	const [memberCount, rep, recentMembers, recentPosts, extras] =
		await Promise.all([
			groupMembershipsService.countByGroupId(group.id),
			groupRepresentativesService.getFirstRepresentativeWithUser(group.id),
			groupMembershipsService.getSomeMembers(group.id, 6),
			postsService.getRecentByGroup(group.id, 3, {
				includeGroupOnly: canSeeGroupOnly,
			}),
			activeGroupExtras({ groupId: group.id, viewerId: user?.id ?? null }),
		]);

	const toPublicUrl = (key: string | null | undefined) =>
		publicImageUrlFromKey(key);

	const repData = rep
		? {
				name: `${rep.user.name} ${rep.user.familyName}`,
				subtitle: `Local Rep ${group.name}`,
				profilePictureUrl: rep.user.profilePictureSmallUrl,
				profileUrl: buildProfileUrl(rep.user),
			}
		: null;

	return {
		...extras,
		group,
		memberCount,
		// Sections of modules that are not active fall back to empty.
		pastEventCount: extras.pastEventCount ?? 0,
		upcomingEvents: extras.upcomingEvents ?? [],
		recentMembers: recentMembers.map((m) => ({
			id: m.id,
			name: m.name,
			familyName: m.familyName,
			profilePictureSmall: m.profilePictureSmallUrl,
			profileUrl: buildProfileUrl(m),
		})),
		rep: repData,
		isMember,
		isLoggedIn: !!user,
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

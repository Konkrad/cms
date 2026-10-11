import type { RequestEventLoader } from "@qwik.dev/router";
import type { ScopeViewData } from "~/contracts/scopes";
import { postsService } from "~/core/content/posts.service";
import { publicImageUrlFromKey } from "~/core/media/images";
import { activeScopeExtras } from "~/core/registry/manifests";
import { scopeUrl } from "~/core/router/scope-path";
import { currentUser, isMember } from "~/core/scopes/access";
import {
	localFirst,
	scopeContentFilter,
	scopeSourceLabels,
} from "~/core/scopes/content-filter";
import type { Scope } from "~/core/scopes/schema/scopes";
import { toScopeListItem } from "~/core/scopes/scope-list";
import { scopesService } from "~/core/scopes/scopes.service";
import { buildProfileUrl } from "~/core/users/format";

/**
 * Server-only: the public home page of a scope (`/germany/berlin`). Posts and events follow
 * the listing rule of `scopeContentFilter`: the scope's own and its ancestors' items as far as
 * the viewer may see them, plus public items from the scopes below.
 */
export async function loadScopeHome(
	event: RequestEventLoader,
	scope: Scope,
): Promise<ScopeViewData> {
	const user = await currentUser(event);
	const [member, ancestors, filter] = await Promise.all([
		isMember(user, scope.id),
		scopesService.getAncestors(scope.id),
		// The scope's listing: its own and its ancestors' posts by visibility, public posts
		// from the scopes below.
		scopeContentFilter(user, scope),
	]);

	const [memberCount, reps, recentMembers, postCandidates, children, extras] =
		await Promise.all([
			scopesService.countMembers(scope.id, { includeDescendants: true }),
			scopesService.listRoleHolders(scope.id),
			scopesService.listMembers(scope.id, {
				includeDescendants: true,
				limit: 6,
			}),
			postsService.getRecent(filter, 30),
			scopesService.getChildrenWithMemberCounts(scope.id),
			activeScopeExtras({ scopeId: scope.id, viewerId: user?.id ?? null }),
		]);

	const rep = reps.find((r) => r.role === "representative");
	// The scope's own (and its subtree's) posts first, then the ancestors', newest first.
	const recentPosts = localFirst(postCandidates, filter, 3).sort((a, b) =>
		b.createdAt.localeCompare(a.createdAt),
	);
	// Posts of other scopes are labelled with their source.
	const sources = await scopeSourceLabels(
		scope.id,
		recentPosts.map((p) => p.scopeId),
	);

	return {
		...extras,
		scope: {
			id: scope.id,
			name: scope.name,
			kind: scope.kind,
			description: scope.description,
		},
		parents: ancestors
			.filter((a) => a.parentId !== null)
			.map((a) => ({ name: a.name, url: scopeUrl(a.path) })),
		childScopes: children.map(toScopeListItem),
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
		rep: rep
			? {
					name: `${rep.name} ${rep.familyName}`,
					subtitle: `Local Rep ${scope.name}`,
					profilePictureUrl: rep.profilePictureSmallUrl,
					profileUrl: buildProfileUrl(rep),
				}
			: null,
		isMember: member,
		isLoggedIn: !!user,
		recentPosts: recentPosts.map((p) => ({
			id: p.id,
			title: p.title,
			body: p.body,
			createdAt: p.createdAt,
			featuredImage: publicImageUrlFromKey(p.featuredImage ?? null),
			authorName: `${p.user.name} ${p.user.familyName}`,
			source: sources[p.scopeId] ?? null,
		})),
		image1: publicImageUrlFromKey(scope.image1),
		image2: publicImageUrlFromKey(scope.image2),
		image3: publicImageUrlFromKey(scope.image3),
	};
}

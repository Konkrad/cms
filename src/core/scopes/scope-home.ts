import type { RequestEventLoader } from "@qwik.dev/router";
import type { ScopeViewData } from "~/contracts/scopes";
import { postsService } from "~/core/content/posts.service";
import { publicImageUrlFromKey } from "~/core/media/images";
import { activeScopeExtras } from "~/core/registry/manifests";
import { scopeUrl } from "~/core/router/scope-path";
import { canViewScope, currentUser, isMember } from "~/core/scopes/access";
import type { Scope } from "~/core/scopes/schema/scopes";
import { toScopeListItem } from "~/core/scopes/scope-list";
import { scopesService } from "~/core/scopes/scopes.service";
import { buildProfileUrl } from "~/core/users/format";

/**
 * Server-only: the public home page of a scope (`/germany/berlin`). Members-only posts and
 * events are included only for members of the scope (or of a scope below it) and role holders.
 */
export async function loadScopeHome(
	event: RequestEventLoader,
	scope: Scope,
): Promise<ScopeViewData> {
	const user = await currentUser(event);
	const [member, canSeeMembersOnly, ancestors] = await Promise.all([
		isMember(user, scope.id),
		canViewScope(user, scope.id, "members"),
		scopesService.getAncestors(scope.id),
	]);

	const [memberCount, reps, recentMembers, recentPosts, children, extras] =
		await Promise.all([
			scopesService.countMembers(scope.id, { includeDescendants: true }),
			scopesService.listRoleHolders(scope.id),
			scopesService.listMembers(scope.id, {
				includeDescendants: true,
				limit: 6,
			}),
			postsService.getRecentByScope(scope.id, 3, {
				includeGroupOnly: canSeeMembersOnly,
			}),
			scopesService.getChildrenWithMemberCounts(scope.id),
			activeScopeExtras({ scopeId: scope.id, viewerId: user?.id ?? null }),
		]);

	const rep = reps.find((r) => r.role === "representative");

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
		})),
		image1: publicImageUrlFromKey(scope.image1),
		image2: publicImageUrlFromKey(scope.image2),
		image3: publicImageUrlFromKey(scope.image3),
	};
}

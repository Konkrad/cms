import { $, useSignal, useTask$ } from "@qwik.dev/core";
import type { RequestEventCommon } from "@qwik.dev/router";
import { server$ } from "@qwik.dev/router";
import type { ScopeMembersPage } from "~/contracts/scopes";
import { t } from "~/core/i18n";

const PAGE_SIZE = 20;

// Members of the page's scope (the URL's scope prefix) and of every scope below it, oldest
// membership first. Logged-in viewers only, like the tile's "See all" button.
const fetchScopeMembers = server$(async function (
	offset: number,
): Promise<ScopeMembersPage> {
	const event = this as RequestEventCommon;
	const { getServerSession } = await import("~/core/auth/server-auth");
	const session = await getServerSession(event);
	if (!session) throw event.error(401, "Unauthorized");

	const { currentScope } = await import("~/core/router/scope-request");
	const { scopesService } = await import("~/core/scopes/scopes.service");
	const { buildProfileUrl } = await import("~/core/users/format");
	const { assertNoPrivateFields } = await import(
		"~/core/shared/no-private-fields"
	);

	const scope = await currentScope(event);
	if (!scope) throw event.error(404, "Not found");
	// One extra row tells whether another page follows.
	const rows = await scopesService.listMembers(scope.id, {
		includeDescendants: true,
		limit: PAGE_SIZE + 1,
		offset: Math.max(0, Math.floor(offset) || 0),
	});
	return assertNoPrivateFields({
		members: rows.slice(0, PAGE_SIZE).map((m) => ({
			id: m.id,
			name: m.name,
			familyName: m.familyName,
			profilePictureSmall: m.profilePictureSmallUrl,
			profileUrl: buildProfileUrl(m),
		})),
		hasMore: rows.length > PAGE_SIZE,
	});
});

/**
 * Headless composable for the full member list of a scope home page: loads the first page
 * when the component mounts (open the list to mount it), `loadMore` appends the next one.
 */
export function useScopeMembers() {
	const members = useSignal<ScopeMembersPage["members"]>([]);
	const hasMore = useSignal(false);
	const isLoading = useSignal(true);
	const isLoadingMore = useSignal(false);
	const error = useSignal<string | null>(null);

	useTask$(async () => {
		try {
			const page = await fetchScopeMembers(0);
			members.value = page.members;
			hasMore.value = page.hasMore;
		} catch {
			error.value = t("core.scopes.membersLoadFailed");
		} finally {
			isLoading.value = false;
		}
	});

	const loadMore = $(async () => {
		if (!hasMore.value || isLoadingMore.value) return;
		isLoadingMore.value = true;
		try {
			const page = await fetchScopeMembers(members.value.length);
			members.value = [...members.value, ...page.members];
			hasMore.value = page.hasMore;
		} catch {
			error.value = t("core.scopes.membersLoadFailed");
		} finally {
			isLoadingMore.value = false;
		}
	});

	return { members, hasMore, isLoading, isLoadingMore, error, loadMore };
}

import { component$, Slot } from "@qwik.dev/core";
import type { RequestHandler } from "@qwik.dev/router";
import { routeAction$, routeLoader$ } from "@qwik.dev/router";
import type { NavUser } from "~/contracts/layout";
import {
	deleteSession,
	getCurrentUserData,
	getServerSession,
} from "~/core/auth/server-auth";
import { menuItemsService } from "~/core/content/menu-items.service";
import { resolveMenuUrls } from "~/core/content/menu-links";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/core/media/images";
import { requirements } from "~/core/registry/requirements";
import { GLOBAL_CONTEXT } from "~/core/requirements/define";
import { currentScopePath } from "~/core/router/scope-request";
import { listManagedScopes } from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { formatUser } from "~/core/users/format";
import { env } from "~/env";
import { Navigation } from "~theme/chrome/Navigation/Navigation";
import { SiteFooter } from "~theme/chrome/SiteFooter/SiteFooter";

/** Paths a user with pending `global` requirements may still open (setup itself, auth, APIs). */
const SETUP_EXEMPT = [
	"/profile/setup",
	"/onboarding",
	"/login",
	"/auth/",
	"/api/",
];

/**
 * The global gate (spec 4.6): while a requirement of the `global` context is pending (profile
 * basics, location, the onboarding survey, or a module's), every page sends a logged-in user to
 * the setup flow, which brings them back to the page afterwards.
 */
export const onRequest: RequestHandler = async (event) => {
	const { pathname, search } = event.url;
	const isExempt = SETUP_EXEMPT.some((prefix) => pathname.startsWith(prefix));
	if (!isExempt) {
		const user = await getServerSession(event);
		if (user && (await requirements.pending(user, GLOBAL_CONTEXT)).length > 0) {
			const next = encodeURIComponent(`${pathname}${search}`);
			throw event.redirect(302, `/profile/setup?next=${next}`);
		}
	}
	await event.next();
};

export const onGet: RequestHandler = async ({ cacheControl }) => {
	// Every page renders through useUserSession below, so a shared/stale
	// cache here can serve one visitor's logged-in (or logged-out) nav state
	// to another, or serve a pre-login page after the visitor just logged in
	// until they force a refresh. Same noCache pattern already used for
	// admin/layout.tsx and events/[id]/index.tsx.
	cacheControl({ noCache: true });
};

export const useServerTimeLoader = routeLoader$(() => {
	console.log("[Layout] useServerTimeLoader - loading");
	return {
		date: new Date().toISOString(),
	};
});

/**
 * The logged-in user as the nav needs it (see ~/contracts/layout#NavUser). Built here
 * so the full user row (email, location...) never reaches the page.
 */
export const useUserSession = routeLoader$(async (event): Promise<NavUser> => {
	const u = await getCurrentUserData(event);
	if (!u) return null;
	const thumbKey = u.profilePicture
		? (u.profilePictureSmall ?? deriveThumbnailKey(u.profilePicture))
		: null;
	return assertNoPrivateFields({
		id: u.id,
		displayName: u.name ? formatUser(u, true).displayName : "User",
		isAdmin: (await listManagedScopes(u)).length > 0,
		profilePictureSmallUrl: publicImageUrlFromKey(thumbKey),
	});
});

export const useScopePath = routeLoader$((event) => currentScopePath(event));

export const useMenuItems = routeLoader$(async () => {
	console.log("[Layout] useMenuItems - starting");
	try {
		const menuTree = await resolveMenuUrls(
			await menuItemsService.getMenuTree("main"),
		);
		console.log(
			"[Layout] useMenuItems - completed, items count:",
			menuTree.length,
		);
		return menuTree;
	} catch (error) {
		console.error("[Layout] Failed to load menu items:", error);
		return [];
	}
});

export const useFooterMenuItems = routeLoader$(async () => {
	try {
		return await resolveMenuUrls(await menuItemsService.getAll("footer"));
	} catch (error) {
		console.error("[Layout] Failed to load footer items:", error);
		return [];
	}
});

export const useLogoutAction = routeAction$(async (_, { cookie, redirect }) => {
	const token = cookie.get("session")?.value;

	if (token) {
		try {
			await deleteSession(token);
		} catch (err) {
			// Log but continue to clear cookie regardless
			console.error("[useLogoutAction] failed to delete session row", err);
		}
	}

	// Clear the cookie (set to expired)
	cookie.set("session", "", {
		httpOnly: true,
		secure: env.isProduction,
		sameSite: "Strict",
		path: "/",
		expires: new Date(0),
	});

	// Also clear legacy supabase cookies (if present) to be safe
	cookie.delete("sb-access-token", { path: "/" });
	cookie.delete("sb-refresh-token", { path: "/" });

	throw redirect(302, "/");
});

export default component$(() => {
	const user = useUserSession();
	const menu = useMenuItems();
	const footer = useFooterMenuItems();
	const logoutAction = useLogoutAction();
	const scopePath = useScopePath();

	return (
		<>
			<Navigation
				user={user.value}
				menuItems={menu.value}
				logoutAction={logoutAction}
			/>
			<main class="min-h-screen" data-scope={scopePath.value}>
				<Slot />
			</main>
			<SiteFooter footerItems={footer.value} />
		</>
	);
});

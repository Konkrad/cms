import { component$, Slot } from "@qwik.dev/core";
import type { RequestHandler } from "@qwik.dev/router";
import { routeAction$, routeLoader$ } from "@qwik.dev/router";
import { eq } from "drizzle-orm";
import type { NavUser } from "~/contracts/layout";
import { db } from "~/db/connection";
import { sessions } from "~/db/schema";
import { env } from "~/env";
import { menuItemsService } from "~/services/menu-items.service";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/utils/images";
import { getCurrentUserData } from "~/utils/server-auth";
import { formatUser } from "~/utils/users";
import { Navigation } from "~theme/chrome/Navigation/Navigation";
import { SiteFooter } from "~theme/chrome/SiteFooter/SiteFooter";

const ONBOARDING_EXEMPT = ["/profile/setup", "/login", "/auth/", "/api/"];

export const onRequest: RequestHandler = async (event) => {
	const { pathname } = new URL(event.request.url);
	const isExempt = ONBOARDING_EXEMPT.some((prefix) =>
		pathname.startsWith(prefix),
	);
	if (!isExempt) {
		const user = await getCurrentUserData(event);
		if (user) {
			const consent = (user as any).consent ?? {};
			if (!consent.lastProfileUpdate || !consent.locationVerification) {
				throw event.redirect(302, "/profile/setup");
			}
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

// Public S3 base URL, resolved at request time (not baked in at build time)
// so a drop-in themed deployment can point at its own bucket without a core
// rebuild. Available anywhere under this layout via `useS3BaseUrl()` — core
// components may call it directly; theme components must receive it as a
// prop instead (see publicImageUrlFromKey in ~/utils/images).
export const useS3BaseUrl = routeLoader$(() => env.S3_BASE_URL);

export const useServerTimeLoader = routeLoader$(() => {
	console.log("[Layout] useServerTimeLoader - loading");
	return {
		date: new Date().toISOString(),
	};
});

export const useUserSession = routeLoader$(async (event) => {
	console.log("[Layout] useUserSession - starting");
	const userData = await getCurrentUserData(event);
	console.log("[Layout] useUserSession - completed, has user:", !!userData);

	if (!userData) return userData;

	let profilePictureSmallUrl: string | null = null;
	const u = userData as any;
	if (u.profilePicture) {
		const thumbKey =
			u.profilePictureSmall ?? deriveThumbnailKey(u.profilePicture);
		profilePictureSmallUrl = publicImageUrlFromKey(thumbKey, env.S3_BASE_URL);
	}

	return { ...userData, profilePictureSmallUrl };
});

export const useMenuItems = routeLoader$(async () => {
	console.log("[Layout] useMenuItems - starting");
	try {
		const menuTree = await menuItemsService.getMenuTree("main");
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
		const items = await menuItemsService.getAll("footer");
		return items;
	} catch (error) {
		console.error("[Layout] Failed to load footer items:", error);
		return [];
	}
});

export const useLogoutAction = routeAction$(async (_, { cookie, redirect }) => {
	const token = cookie.get("session")?.value;

	if (token) {
		try {
			await db.delete(sessions).where(eq(sessions.token, token));
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

	// Secret-stripped snapshot handed to the theme — see ~/contracts/layout#NavUser.
	// The theme never sees the raw user row (email, tokens, etc.).
	const navUser: NavUser = (() => {
		const u = user.value as any;
		if (!u || typeof u !== "object") return null;
		const isAdmin = u.role === "admin";
		const displayName = u.name
			? formatUser(u, true).displayName
			: (u.email ?? u.id ?? "User");
		return {
			id: u.id,
			role: u.role ?? null,
			displayName,
			isAdmin,
			profilePictureSmallUrl: u.profilePictureSmallUrl ?? null,
		};
	})();

	return (
		<>
			<Navigation
				user={navUser}
				menuItems={menu.value}
				logoutAction={logoutAction}
			/>
			<main class="min-h-screen">
				<Slot />
			</main>
			<SiteFooter footerItems={footer.value} />
		</>
	);
});

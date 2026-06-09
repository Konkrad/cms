import { component$, Slot } from "@qwik.dev/core";
import type { RequestHandler } from "@qwik.dev/router";
import { routeAction$, routeLoader$ } from "@qwik.dev/router";
import { Navigation } from "~/components/ui/Navigation";
import { SiteFooter } from "~/components/ui/SiteFooter/SiteFooter";
import { menuItemsService } from "~/services/menu-items.service";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/utils/images";
import { getCurrentUserData } from "~/utils/server-auth";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { sessions } from "~/db/schema";
import { env } from "~/env";

const ONBOARDING_EXEMPT = ["/profile/setup", "/login", "/auth/", "/api/"];

export const onRequest: RequestHandler = async (event) => {
  const { pathname } = new URL(event.request.url);
  const isExempt = ONBOARDING_EXEMPT.some((prefix) => pathname.startsWith(prefix));
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
  cacheControl({
    staleWhileRevalidate: 60 * 60 * 24 * 7,
    maxAge: 5,
  });
};

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
    const thumbKey = u.profilePictureSmall ?? deriveThumbnailKey(u.profilePicture);
    profilePictureSmallUrl = publicImageUrlFromKey(thumbKey);
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
  console.log("[Layout] Component rendering - start");

  // Trigger loaders here so we can inspect their values during SSR
  const user = useUserSession();
  const menu = useMenuItems();

  // Safely extract a minimal snapshot of user and menu to avoid capturing
  const safeUser = user.value
    ? {
        id: (user.value as any).id ?? null,
        role: (user.value as any).role ?? null,
      }
    : null;

  let menuCount: number | null = null;
  let menuSampleIds: any[] = [];
  try {
    if (Array.isArray(menu.value)) {
      menuCount = menu.value.length;
      menuSampleIds = menu.value.slice(0, 5).map((i: any) => i.id);
    }
  } catch (err) {
    console.error("[Layout] Error reading menu.value:", err);
  }

  console.log("[Layout] user (safe):", safeUser);
  console.log(
    "[Layout] menuCount:",
    menuCount,
    "menuSampleIds:",
    menuSampleIds,
  );
  console.log("[Layout] Rendering Navigation (about to mount)");

  return (
    <>
      <Navigation />
      <main class="min-h-screen">
        <Slot />
      </main>
      <SiteFooter />
    </>
  );
});

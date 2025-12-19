import { component$, Slot } from "@builder.io/qwik";
import type { RequestHandler } from "@builder.io/qwik-city";
import { routeAction$, routeLoader$ } from "@builder.io/qwik-city";
import { Navigation } from "~/components/ui/Navigation";
import { menuItemsService } from "~/services/menu-items.service";
import { getCurrentUserData } from "~/utils/server-auth";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { sessions } from "~/db/schema";
import { env } from "~/env";

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
  return userData;
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
  console.log("[Layout] Component rendering");
  return (
    <>
      <Navigation />
      <main class="min-h-screen">
        <Slot />
      </main>
    </>
  );
});

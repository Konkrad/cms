import { component$, Slot } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import type { RequestHandler } from '@builder.io/qwik-city';
import { Navigation } from '~/components/ui/Navigation';
import { getCurrentUserData } from '~/utils/server-auth';
import { menuItemsService } from '~/services/menu-items.service';

export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    staleWhileRevalidate: 60 * 60 * 24 * 7,
    maxAge: 5,
  });
};

export const useServerTimeLoader = routeLoader$(() => {
  console.log('[Layout] useServerTimeLoader - loading');
  return {
    date: new Date().toISOString(),
  };
});

export const useUserSession = routeLoader$(async (event) => {
  console.log('[Layout] useUserSession - starting');
  const userData = await getCurrentUserData(event);
  console.log('[Layout] useUserSession - completed, has user:', !!userData);
  return userData;
});

export const useMenuItems = routeLoader$(async () => {
  console.log('[Layout] useMenuItems - starting');
  try {
    const menuTree = await menuItemsService.getMenuTree('main');
    console.log('[Layout] useMenuItems - completed, items count:', menuTree.length);
    return menuTree;
  } catch (error) {
    console.error('[Layout] Failed to load menu items:', error);
    return [];
  }
});

export default component$(() => {
  console.log('[Layout] Component rendering');
  return (
    <>
      <Navigation />
      <main class="min-h-screen">
        <Slot />
      </main>
    </>
  );
});

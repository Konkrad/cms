import { $, component$, useSignal } from "@builder.io/qwik";
import { Form, Link, useLocation } from "@builder.io/qwik-city";
import { useLogoutAction, useUserSession, useMenuItems } from "~/routes/layout";

export const Navigation = component$(() => {
  const user = useUserSession();
  const menu = useMenuItems();
  const location = useLocation();
  // menuItems removed - now only the Login button is shown for unauthenticated users
  const logoutAction = useLogoutAction();
  const showUserMenu = useSignal(false);

  const safeUserSnapshot = (() => {
    try {
      const v = user.value;
      if (v && typeof v === "object") {
        return {
          id: (v as any).id ?? null,
          role: (v as any).role ?? null,
          displayName: (v as any).displayName ?? null,
        };
      }
      return String(v);
    } catch (e) {
      console.error("[Navigation] safeUserSnapshot error", e);
      return null;
    }
  })();

  const menuSnapshot = (() => {
    try {
      if (Array.isArray(menu.value)) {
        return {
          count: menu.value.length,
          sampleIds: menu.value.slice(0, 5).map((i: any) => i.id),
        };
      }
      return null;
    } catch (e) {
      console.error("[Navigation] menuSnapshot error", e);
      return null;
    }
  })();

  console.log(
    "[Navigation] rendering - safeUser:",
    safeUserSnapshot,
    "menu:",
    menuSnapshot,
    "showUserMenu:",
    showUserMenu.value,
  );

  const isAdmin =
    typeof user.value === "object" && user.value !== null
      ? (user.value as any).role === "admin" ||
        (user.value as any).role === "moderator"
      : false;

  const displayName = (() => {
    try {
      if (user.value && typeof user.value === "object") {
        return (
          (user.value as any).displayName ??
          (user.value as any).email ??
          (user.value as any).id ??
          "User"
        );
      }
      return String(user.value ?? "");
    } catch (e) {
      console.error("[Navigation] error computing displayName", e);
      return String(user.value ?? "");
    }
  })();

  const toggleUserMenu = $(() => {
    try {
      showUserMenu.value = !showUserMenu.value;
      console.log("[Navigation] toggleUserMenu =>", showUserMenu.value);
    } catch (e) {
      console.error("[Navigation] toggleUserMenu error:", e);
    }
  });

  return (
    <nav class="bg-white shadow-md">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <Link
              href="/"
              class="flex items-center px-3 text-xl font-bold text-blue-500 hover:text-blue-600"
            >
              Community Hub
            </Link>
          </div>
          <div class="flex items-center space-x-4">
            {Array.isArray(menu.value) && menu.value.length > 0 && (
              <div class="hidden md:flex items-center space-x-2">
                {menu.value.map((item) =>
                  item.children && item.children.length > 0 ? (
                    <div key={item.id} class="relative group">
                      <a
                        href={item.url || "#"}
                        class="px-3 py-2 text-gray-700 hover:text-blue-500 font-medium transition-colors"
                      >
                        {item.label}
                      </a>

                      <div class="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 hidden group-hover:block">
                        {item.children.map((child) => (
                          <a
                            key={child.id}
                            href={child.url}
                            class="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                          >
                            {child.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <a
                      key={item.id}
                      href={item.url}
                      class="px-3 py-2 text-gray-700 hover:text-blue-500 font-medium transition-colors"
                    >
                      {item.label}
                    </a>
                  ),
                )}
              </div>
            )}

            {user.value ? (
              <div class="relative">
                <button
                  onClick$={toggleUserMenu}
                  class="flex items-center px-3 py-2 text-gray-700 hover:text-blue-500 font-medium transition-colors"
                >
                  {displayName}
                  <svg
                    class="ml-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showUserMenu.value && (
                  <div class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                    <Link
                      href="/profile"
                      class="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      My Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        class="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        Admin Area
                      </Link>
                    )}
                    <Form action={logoutAction}>
                      <button
                        type="submit"
                        class="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        Logout
                      </button>
                    </Form>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                class="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
});

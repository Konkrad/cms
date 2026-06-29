import { $, component$, useSignal } from "@qwik.dev/core";
import { Form, Link, useLocation } from "@qwik.dev/router";
import type { LogoutAction, MainMenuItems, NavUser } from "~/contracts/layout";

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    class={`h-4 w-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
  </svg>
);

/**
 * Themed site navigation. Receives the user/menu/logout-action data as props
 * from `src/routes/layout.tsx` instead of calling its loaders directly, so the
 * theme stays decoupled from core loader identities.
 */
export const Navigation = component$<{
  user: NavUser;
  menuItems: MainMenuItems;
  logoutAction: LogoutAction;
}>(({ user, menuItems, logoutAction }) => {
  useLocation();
  const showUserMenu = useSignal(false);
  const showMobileMenu = useSignal(false);
  // ID of the open mobile submenu ("user" or a nav item id), null = all collapsed
  const openMobileSubmenu = useSignal<string | null>(null);

  const menu = Array.isArray(menuItems) ? menuItems : [];

  const toggleUserMenu = $(() => {
    showUserMenu.value = !showUserMenu.value;
  });

  const toggleMobileMenu = $(() => {
    showMobileMenu.value = !showMobileMenu.value;
  });

  const toggleMobileSubmenu = $((id: string) => {
    openMobileSubmenu.value = openMobileSubmenu.value === id ? null : id;
  });

  return (
    <nav class="bg-white shadow-md relative">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <Link
              href="/"
              class="flex items-center px-3 text-xl font-bold text-primary hover:text-primary"
            >
              Community Hub
            </Link>
          </div>

          <div class="flex items-center space-x-4">
            {/* Desktop nav items */}
            {menu.length > 0 && (
              <div class="hidden md:flex items-center space-x-2">
                {menu.map((item) =>
                  item.children && item.children.length > 0 ? (
                    <div key={item.id} class="relative group">
                      <a
                        href={item.url || "#"}
                        class="px-3 py-2 text-text-secondary hover:text-primary font-medium transition-colors"
                      >
                        {item.title}
                      </a>
                      <div class="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 hidden group-hover:block">
                        {item.children.map((child) => (
                          <a
                            key={child.id}
                            href={child.url}
                            class="block px-4 py-2 text-text-secondary hover:bg-bg-muted"
                          >
                            {child.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <a
                      key={item.id}
                      href={item.url}
                      class="px-3 py-2 text-text-secondary hover:text-primary font-medium transition-colors"
                    >
                      {item.title}
                    </a>
                  ),
                )}
              </div>
            )}

            {/* Desktop user menu */}
            <div class="hidden md:block">
              {user ? (
                <div class="relative">
                  <button
                    onClick$={toggleUserMenu}
                    aria-label="profile-menu"
                    aria-haspopup="menu"
                    aria-expanded={showUserMenu.value}
                    class="flex items-center gap-2 px-3 py-2 text-text-secondary hover:text-primary font-medium transition-colors"
                  >
                    {user.profilePictureSmallUrl ? (
                      <img
                        src={user.profilePictureSmallUrl}
                        alt=""
                        width={28}
                        height={28}
                        class="w-7 h-7 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <span class="w-7 h-7 rounded-full bg-border flex items-center justify-center text-text-muted text-xs font-semibold">
                        {user.displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    {user.displayName}
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
                        class="block px-4 py-2 text-text-secondary hover:bg-bg-muted"
                      >
                        My Profile
                      </Link>
                      <Link
                        href="/profile/tickets"
                        class="block px-4 py-2 text-text-secondary hover:bg-bg-muted"
                      >
                        My Tickets
                      </Link>
                      {user.isAdmin && (
                        <Link
                          href="/admin/global"
                          class="block px-4 py-2 text-text-secondary hover:bg-bg-muted"
                        >
                          Admin Area
                        </Link>
                      )}
                      <Form action={logoutAction}>
                        <button
                          type="submit"
                          aria-label="logout"
                          class="block w-full text-left px-4 py-2 text-text-secondary hover:bg-bg-muted"
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
                  class="flex items-center px-4 py-2 bg-primary text-white rounded-sm hover:bg-primary-dark font-medium transition-colors"
                >
                  Login
                </Link>
              )}
            </div>

            {/* Mobile hamburger button */}
            <button
              onClick$={toggleMobileMenu}
              aria-label="toggle mobile menu"
              aria-expanded={showMobileMenu.value}
              class="md:hidden flex items-center justify-center w-10 h-10 rounded-md text-text-secondary hover:text-primary hover:bg-bg-muted transition-colors"
            >
              {showMobileMenu.value ? (
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu panel */}
      {showMobileMenu.value && (
        <div class="md:hidden absolute top-full left-0 right-0 bg-white shadow-lg z-40 border-t border-border">
          {/* User section */}
          {user ? (
            <div class="border-b border-border">
              <button
                onClick$={() => toggleMobileSubmenu("user")}
                class="flex items-center justify-between w-full gap-3 px-4 py-3 bg-bg hover:bg-bg-muted transition-colors"
                aria-expanded={openMobileSubmenu.value === "user"}
              >
                <div class="flex items-center gap-3">
                  {user.profilePictureSmallUrl ? (
                    <img
                      src={user.profilePictureSmallUrl}
                      alt=""
                      width={36}
                      height={36}
                      class="w-9 h-9 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <span class="w-9 h-9 rounded-full bg-border flex items-center justify-center text-text-muted text-sm font-semibold">
                      {user.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span class="font-medium text-text">{user.displayName}</span>
                </div>
                <Chevron open={openMobileSubmenu.value === "user"} />
              </button>
              {openMobileSubmenu.value === "user" && (
                <>
                  <a href="/profile" class="block px-4 py-3 text-text-secondary hover:bg-bg-muted">
                    My Profile
                  </a>
                  <a href="/profile/tickets" class="block px-4 py-3 text-text-secondary hover:bg-bg-muted">
                    My Tickets
                  </a>
                  {user.isAdmin && (
                    <a href="/admin/global" class="block px-4 py-3 text-text-secondary hover:bg-bg-muted">
                      Admin Area
                    </a>
                  )}
                  <Form action={logoutAction}>
                    <button type="submit" aria-label="logout" class="block w-full text-left px-4 py-3 text-text-secondary hover:bg-bg-muted">
                      Logout
                    </button>
                  </Form>
                </>
              )}
            </div>
          ) : (
            <div class="border-b border-border px-4 py-3">
              <a
                href="/login"
                class="flex items-center justify-center w-full px-4 py-2 bg-primary text-white rounded-sm hover:bg-primary-dark font-medium transition-colors"
              >
                Login
              </a>
            </div>
          )}

          {/* Nav items */}
          {menu.length > 0 && (
            <div>
              {menu.map((item) =>
                item.children && item.children.length > 0 ? (
                  <div key={item.id}>
                    <button
                      onClick$={() => toggleMobileSubmenu(item.id)}
                      class="flex items-center justify-between w-full px-4 py-3 text-text-secondary hover:bg-bg-muted font-medium"
                      aria-expanded={openMobileSubmenu.value === item.id}
                    >
                      {item.title}
                      <Chevron open={openMobileSubmenu.value === item.id} />
                    </button>
                    {openMobileSubmenu.value === item.id &&
                      item.children.map((child) => (
                        <a
                          key={child.id}
                          href={child.url}
                          class="block pl-8 pr-4 py-2.5 text-text-secondary hover:bg-bg-muted text-sm"
                        >
                          {child.title}
                        </a>
                      ))}
                  </div>
                ) : (
                  <a
                    key={item.id}
                    href={item.url}
                    class="block px-4 py-3 text-text-secondary hover:bg-bg-muted font-medium"
                  >
                    {item.title}
                  </a>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  );
});

import { component$, useSignal, $ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import { useUserSession } from '~/routes/layout';

export const Navigation = component$(() => {
  const user = useUserSession();
  const showUserMenu = useSignal(false);

  const isAdmin = user.value?.role === 'admin' || user.value?.role === 'moderator';

  const toggleUserMenu = $(() => {
    showUserMenu.value = !showUserMenu.value;
  });

  return (
    <nav class="bg-white shadow-md">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <Link href="/" class="flex items-center px-3 text-xl font-bold text-blue-500 hover:text-blue-600">
              Community Hub
            </Link>
          </div>
          <div class="flex items-center space-x-4">
            <Link
              href="/posts"
              class="flex items-center px-3 py-2 text-gray-700 hover:text-blue-500 font-medium transition-colors"
            >
              Posts
            </Link>
            <Link
              href="/events"
              class="flex items-center px-3 py-2 text-gray-700 hover:text-blue-500 font-medium transition-colors"
            >
              Events
            </Link>

            {user.value ? (
              <div class="relative">
                <button
                  onClick$={toggleUserMenu}
                  class="flex items-center px-3 py-2 text-gray-700 hover:text-blue-500 font-medium transition-colors"
                >
                  {user.value.displayName}
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
                      onClick$={() => showUserMenu.value = false}
                    >
                      My Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        class="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick$={() => showUserMenu.value = false}
                      >
                        Admin Area
                      </Link>
                    )}
                    <a
                      href="/api/auth/logout"
                      class="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Logout
                    </a>
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

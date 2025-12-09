import { component$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';

export const Navigation = component$(() => {
  return (
    <nav class="bg-white shadow-md">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <Link href="/" class="flex items-center px-3 text-xl font-bold text-blue-500 hover:text-blue-600">
              Community Hub
            </Link>
          </div>
          <div class="flex space-x-4">
            <Link
              href="/users"
              class="flex items-center px-3 py-2 text-gray-700 hover:text-blue-500 font-medium transition-colors"
            >
              Users
            </Link>
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
          </div>
        </div>
      </div>
    </nav>
  );
});

import { component$ } from "@builder.io/qwik";
import type { Group } from "~/db/schema";

interface GroupCardProps {
  group: Group;
  showActions?: boolean;
}

export const GroupCard = component$<GroupCardProps>(
  ({ group, showActions = false }) => {
    return (
      <a
        href={`/groups/${group.slug}`}
        class="block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow no-underline text-inherit"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="text-xl font-semibold text-gray-900 mb-2">
              {group.name}
            </h3>
            <p class="text-gray-600 text-sm mb-1">
              📍 Location: {group.latitude}, {group.longitude}
            </p>
            <p class="text-gray-500 text-xs">
              Created: {new Date(group.createdAt).toLocaleDateString()}
            </p>
          </div>
          {showActions && (
            <div class="flex gap-2">
              <span class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded">
                View
              </span>
            </div>
          )}
        </div>
      </a>
    );
  },
);

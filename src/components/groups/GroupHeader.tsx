import { component$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import type { Group } from "~/db/schema";

interface GroupHeaderProps {
  group: Group;
  isMember: boolean;
  joinAction?: any;
}

export const GroupHeader = component$<GroupHeaderProps>(
  ({ group, isMember, joinAction }) => {
    return (
      <div class="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 rounded-t-lg">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h1 class="text-4xl font-bold mb-2">{group.name}</h1>
            <p class="text-blue-100 mb-4">
              📍 Location: {group.latitude}, {group.longitude}
            </p>
            <p class="text-blue-200 text-sm">
              Created: {new Date(group.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div>
            {isMember ? (
              <div class="bg-green-500 text-white px-4 py-2 rounded-lg font-semibold">
                ✓ Member
              </div>
            ) : joinAction ? (
              <Form action={joinAction}>
                <button
                  type="submit"
                  class="px-6 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-semibold disabled:opacity-50"
                  disabled={joinAction.isRunning}
                >
                  {joinAction.isRunning ? "Joining..." : "Join Group"}
                </button>
              </Form>
            ) : (
              <a
                href={`/groups/${group.slug}`}
                class="px-6 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-semibold inline-block"
              >
                Join Group
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }
);

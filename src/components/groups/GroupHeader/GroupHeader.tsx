import { component$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
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
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={joinAction.isRunning}
                >
                  {joinAction.isRunning ? "Joining..." : "Join Group"}
                </Button>
              </Form>
            ) : (
              <Button href={`/groups/${group.slug}`} variant="secondary">
                Join Group
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button/Button";
import { groupsService } from "~/services/groups.service";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { db } from "~/db/connection";
import { posts, events, users, pages } from "~/db/schema";
import { eq, and, isNull, count } from "drizzle-orm";

export const useAdminStats = routeLoader$(async ({ params }) => {
  const groupSlug = params.group_slug;

  if (groupSlug === "global") {
    // Global admin stats (migrated dashboard overview)
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalPosts] = await db
      .select({ count: count() })
      .from(posts)
      .where(isNull(posts.deletedAt));
    const [totalEvents] = await db
      .select({ count: count() })
      .from(events)
      .where(isNull(events.deletedAt));
    const [totalPages] = await db.select({ count: count() }).from(pages);

    return {
      isGlobal: true,
      stats: {
        posts: totalPosts?.count || 0,
        events: totalEvents?.count || 0,
        users: totalUsers?.count || 0,
        pages: totalPages?.count || 0,
      },
    };
  }

  // Group-specific stats
  const group = await groupsService.getBySlug(groupSlug);
  if (!group) {
    return { isGlobal: false, stats: { members: 0, posts: 0, events: 0 } };
  }

  const members = await groupMembershipsService.getGroupMembers(group.id);
  const [groupPosts] = await db
    .select({ count: count() })
    .from(posts)
    .where(and(eq(posts.groupId, group.id), isNull(posts.deletedAt)));
  const [groupEvents] = await db
    .select({ count: count() })
    .from(events)
    .where(and(eq(events.groupId, group.id), isNull(events.deletedAt)));

  return {
    isGlobal: false,
    group,
    stats: {
      members: members.length,
      posts: groupPosts?.count || 0,
      events: groupEvents?.count || 0,
    },
  };
});

export default component$(() => {
  const stats = useAdminStats();

  return (
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-6">
        {stats.value.isGlobal ? "Platform Dashboard" : "Group Dashboard"}
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stats.value.isGlobal ? (
          <>
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-1">Total Users</div>
              <div class="text-3xl font-bold text-gray-900">
                {stats.value.stats.users}
              </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-1">Total Posts</div>
              <div class="text-3xl font-bold text-blue-600">
                {stats.value.stats.posts}
              </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-1">Total Events</div>
              <div class="text-3xl font-bold text-green-600">
                {stats.value.stats.events}
              </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-1">Total Pages</div>
              <div class="text-3xl font-bold text-slate-600">
                {stats.value.stats.pages}
              </div>
            </div>
          </>
        ) : (
          <>
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-1">Members</div>
              <div class="text-3xl font-bold text-gray-900">
                {stats.value.stats.members}
              </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-1">Group Posts</div>
              <div class="text-3xl font-bold text-blue-600">
                {stats.value.stats.posts}
              </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-1">Group Events</div>
              <div class="text-3xl font-bold text-green-600">
                {stats.value.stats.events}
              </div>
            </div>
          </>
        )}
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            href={`/admin/${stats.value.isGlobal ? "global" : stats.value.group?.slug}/events/new`}
            variant="secondary"
          >
            + New Event
          </Button>
          <Button
            href={`/admin/${stats.value.isGlobal ? "global" : stats.value.group?.slug}/posts/new`}
            variant="secondary"
          >
            + New Post
          </Button>
          {stats.value.isGlobal && (
            <Button
              href="/admin/global/pages/new"
              variant="secondary"
            >
              + New Page
            </Button>
          )}
          <Button
            href={`/admin/${stats.value.isGlobal ? "global" : stats.value.group?.slug}/users`}
            variant="secondary"
          >
            View {stats.value.isGlobal ? "Users" : "Members"}
          </Button>
          {stats.value.isGlobal && (
            <Button
              href="/admin/global/groups"
              variant="secondary"
            >
              Manage Groups
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

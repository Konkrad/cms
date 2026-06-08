import { component$ } from "@qwik.dev/core";
import { Form, Link, routeAction$, routeLoader$ } from "@qwik.dev/router";
import { format } from "date-fns";
import { Button } from "~/components/ui/Button";
import { eventsService } from "~/services/events.service";
import { groupsService } from "~/services/groups.service";
import { db } from "~/db/connection";
import { events } from "~/db/schemas/events";
import { users as usersTable } from "~/db/schemas/users";
import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { Pagination, PAGE_SIZE } from "~/components/admin/Pagination/Pagination";
import { SearchBar } from "~/components/admin/SearchBar/SearchBar";

export const useEvents = routeLoader$(async ({ params, url }) => {
  const groupSlug = params.group_slug;
  const search = url.searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const group =
    groupSlug !== "global" ? await groupsService.getBySlug(groupSlug) : null;

  const where = and(
    isNull(events.deletedAt),
    group ? eq(events.groupId, group.id) : undefined,
    search
      ? or(
          like(events.title, `%${search}%`),
          like(events.city, `%${search}%`),
        )
      : undefined,
  );

  const [countRows, rawItems] = await Promise.all([
    db.select({ total: sql<number>`COUNT(*)` }).from(events).where(where),
    db
      .select({
        id: events.id,
        title: events.title,
        startDate: events.startDate,
        visibility: events.visibility,
        groupId: events.groupId,
        userName: usersTable.name,
        userFamilyName: usersTable.familyName,
      })
      .from(events)
      .leftJoin(usersTable, eq(events.userId, usersTable.id))
      .where(where)
      .orderBy(desc(events.startDate))
      .limit(PAGE_SIZE)
      .offset(offset),
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  const { participationService } = await import(
    "~/services/participation.service"
  );
  const eventsWithParticipation = await Promise.all(
    rawItems.map(async (e) => ({
      id: e.id,
      title: e.title,
      startDate: e.startDate,
      visibility: e.visibility,
      organizerName: `${e.userName ?? ""} ${e.userFamilyName ?? ""}`.trim(),
      participationCounts: await participationService.getSummary(e.id),
    })),
  );

  return {
    events: eventsWithParticipation,
    total,
    page,
    pageSize: PAGE_SIZE,
    search,
    groupSlug,
  };
});

export const useDeleteEvent = routeAction$(async (data, { sharedMap }) => {
  const user = sharedMap.get("session");
  if (!user) return { success: false, error: "Unauthorized" };
  await eventsService.softDelete(data.eventId as string, user.id);
  return { success: true };
});

export default component$(() => {
  const data = useEvents();
  const deleteEventAction = useDeleteEvent();
  const totalPages = Math.ceil(data.value.total / data.value.pageSize);

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          {data.value.groupSlug === "global" ? "All Events" : "Group Events"}
        </h2>
        <Button href={`/admin/${data.value.groupSlug}/events/new`}>
          Create New Event
        </Button>
      </div>

      <SearchBar value={data.value.search} placeholder="Search by title or city…" />

      <div class="bg-white shadow-sm rounded-lg overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Visibility
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Participants
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {data.value.events.map((event) => (
              <tr key={event.id}>
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900">
                    {event.title}
                  </div>
                  <div class="text-sm text-gray-500">{event.organizerName}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(event.startDate), "MMM d, yyyy")}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class={`px-2 py-1 text-xs font-semibold rounded-full ${
                      event.visibility === "group-only"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {event.visibility === "group-only" ? "Group Only" : "Global"}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {event.participationCounts.yes || 0} going
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                  <Link
                    href={`/admin/${data.value.groupSlug}/events/${event.id}/details`}
                    class="text-blue-600 hover:text-blue-900"
                  >
                    View
                  </Link>
                  <Link
                    href={`/admin/${data.value.groupSlug}/events/${event.id}/edit`}
                    class="text-indigo-600 hover:text-indigo-900"
                  >
                    Edit
                  </Link>
                  <Form action={deleteEventAction} class="inline">
                    <input type="hidden" name="eventId" value={event.id} />
                    <button
                      type="submit"
                      preventdefault:click
                      class="text-red-600 hover:text-red-900"
                      onClick$={(e) => {
                        if (
                          !confirm("Are you sure you want to delete this event?")
                        )
                          return;
                        (e.target as HTMLElement)
                          .closest("form")
                          ?.requestSubmit();
                      }}
                    >
                      Delete
                    </button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.value.events.length === 0 && (
          <div class="text-center py-12 text-gray-500">
            {data.value.search
              ? `No events matching "${data.value.search}".`
              : "No events found."}
          </div>
        )}
        <Pagination
          page={data.value.page}
          totalPages={totalPages}
          total={data.value.total}
          pageSize={data.value.pageSize}
        />
      </div>
    </div>
  );
});

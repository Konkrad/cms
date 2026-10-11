import { component$ } from "@qwik.dev/core";
import { Form, Link, routeAction$, z, zod$ } from "@qwik.dev/router";
import { format } from "date-fns";
import { Button, Pagination, SearchBar } from "~/core/ui";
import { eventsService } from "../services/events";
import { requireAdminEventById } from "./event-guards";
import type { AdminEventsData } from "./list-data";

export const useDeleteEvent = routeAction$(
	async (data, event) => {
		const { user } = await requireAdminEventById(event, data.eventId);
		await eventsService.softDelete(data.eventId, user.id);
		return { success: true };
	},
	zod$({ eventId: z.string().min(1) }),
);

type Props = { data: AdminEventsData };

export const AdminEventsList = component$<Props>(({ data }) => {
	const deleteEventAction = useDeleteEvent();
	const totalPages = Math.ceil(data.total / data.pageSize);

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">
					{data.isRoot ? "All Events" : "Group Events"}
				</h2>
				<Button href={`${data.adminBase}/events/new`}>Create New Event</Button>
			</div>

			<SearchBar value={data.search} placeholder="Search by title or city…" />

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
						{data.events.map((event) => (
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
										{event.visibility === "group-only"
											? "Group Only"
											: "Global"}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{event.participationCounts.yes || 0} going
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
									<Link
										href={`${data.adminBase}/events/${event.id}/details`}
										class="text-blue-600 hover:text-blue-900"
									>
										View
									</Link>
									<Link
										href={`${data.adminBase}/events/${event.id}/edit`}
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
													!confirm(
														"Are you sure you want to delete this event?",
													)
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
				{data.events.length === 0 && (
					<div class="text-center py-12 text-gray-500">
						{data.search
							? `No events matching "${data.search}".`
							: "No events found."}
					</div>
				)}
				<Pagination
					page={data.page}
					totalPages={totalPages}
					total={data.total}
					pageSize={data.pageSize}
				/>
			</div>
		</div>
	);
});

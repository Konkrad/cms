import { component$ } from "@qwik.dev/core";
import { Form, Link, routeAction$, z, zod$ } from "@qwik.dev/router";
import {
	Button,
	formatDate,
	Pagination,
	SearchBar,
	t,
	VISIBILITY_LABELS,
} from "~/core/ui";
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
					{data.isRoot
						? t("events.admin.list.allEvents")
						: t("events.admin.list.groupEvents")}
				</h2>
				<Button href={`${data.adminBase}/events/new`}>
					{t("events.admin.list.createNewEvent")}
				</Button>
			</div>

			{data.overdueDebriefs.length > 0 && (
				<section
					class="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4"
					data-testid="overdue-debriefs"
				>
					<h3 class="font-semibold text-amber-900 mb-2">
						{t("events.admin.list.overdueDebriefs")}
					</h3>
					<ul class="text-sm space-y-1">
						{data.overdueDebriefs.map((e) => (
							<li key={e.id}>
								<Link
									href={`${data.adminBase}/events/${e.id}/review`}
									class="text-blue-700 hover:underline"
								>
									{e.title}
								</Link>{" "}
								<span class="text-gray-600">
									{t("events.admin.list.ended", {
										endDate: formatDate(e.endDate),
									})}
								</span>
							</li>
						))}
					</ul>
				</section>
			)}

			<SearchBar
				value={data.search}
				placeholder={t("events.admin.list.searchByTitleOrCity")}
			/>

			<div class="bg-white shadow-sm rounded-lg overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("events.admin.list.event")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("events.admin.list.date")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("events.admin.list.visibility")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("events.admin.list.participants")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("events.admin.list.actions")}
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
									{formatDate(event.startDate)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span
										class={`px-2 py-1 text-xs font-semibold rounded-full ${
											event.visibility === "public"
												? "bg-green-100 text-green-800"
												: "bg-blue-100 text-blue-800"
										}`}
									>
										{VISIBILITY_LABELS[event.visibility].label}
									</span>
									{event.status !== "published" && (
										<span
											class="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800"
											data-event-status={event.status}
										>
											{event.status === "draft"
												? t("events.admin.list.draft")
												: t("events.admin.list.inReview")}
										</span>
									)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{event.participationCounts.yes || 0}{" "}
									{t("events.admin.list.going")}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
									<Link
										href={`${data.adminBase}/events/${event.id}/details`}
										class="text-blue-600 hover:text-blue-900"
									>
										{t("events.admin.list.view")}
									</Link>
									<Link
										href={`${data.adminBase}/events/${event.id}/edit`}
										class="text-indigo-600 hover:text-indigo-900"
									>
										{t("events.admin.list.edit")}
									</Link>
									<Form action={deleteEventAction} class="inline">
										<input type="hidden" name="eventId" value={event.id} />
										<button
											type="submit"
											preventdefault:click
											class="text-red-600 hover:text-red-900"
											onClick$={(e) => {
												if (!confirm(t("events.admin.list.areYouSureYouWant")))
													return;
												(e.target as HTMLElement)
													.closest("form")
													?.requestSubmit();
											}}
										>
											{t("events.admin.list.delete")}
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
							? t("events.admin.list.noEventsMatching", { search: data.search })
							: t("events.admin.list.noEventsFound")}
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

import { component$ } from "@qwik.dev/core";
import { useUpcomingEvents } from "~/components/builder/blocks/useUpcomingEvents";
import type { BlockDefinition } from "~/contracts/blocks";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";

export const definition: BlockDefinition = {
	name: "Upcoming Events",
	componentType: "UpcomingEventsBlock",
	category: "dynamic",
	icon: "📅",
	configSchema: [],
	defaultData: {},
};

function formatEventDate(startDate: string, endDate?: string): string {
	const start = new Date(startDate);
	const day = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(
		start,
	);
	const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
		start,
	);
	const startTime = new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(start);

	if (!endDate) return `${day} ${month} · ${startTime}`;

	const endTime = new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(new Date(endDate));

	return `${day} ${month} · ${startTime} - ${endTime}`;
}

export default component$(() => {
	const { events, nextCursor, isLoading, isLoadingMore, error, loadMore } =
		useUpcomingEvents();

	return (
		<div class="max-w-6xl mx-auto px-4 py-12">
			{isLoading.value ? (
				<div class="text-center py-12">
					<p class="text-text-muted">Loading upcoming events...</p>
				</div>
			) : error.value ? (
				<p class="text-error text-center py-8">
					Failed to load events: {error.value}
				</p>
			) : events.value.length === 0 ? (
				<p class="text-text-muted text-center py-8">No upcoming events.</p>
			) : (
				<>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{events.value.map((event) => {
							const location =
								event.city ||
								event.address ||
								(event.locationType === "online" ? "Online" : "TBA");
							return (
								<ContentCard
									key={event.id}
									title={event.title}
									image={event.image1}
									date={formatEventDate(event.startDate, event.endDate)}
									meta={location}
									description={event.body
										?.replace(/<[^>]+>/g, "")
										.substring(0, 180)}
									href={`/events/${event.id}`}
									label="Open Tickets"
								/>
							);
						})}
					</div>

					{nextCursor.value && (
						<div class="flex justify-center pt-6">
							<button
								type="button"
								class="px-6 py-2 border border-border text-sm font-medium text-text-secondary bg-bg-card hover:bg-bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
								onClick$={loadMore}
								disabled={isLoadingMore.value}
							>
								{isLoadingMore.value ? "Loading..." : "Load More"}
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
});

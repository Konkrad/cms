import { component$ } from "@qwik.dev/core";
import { usePastEvents } from "~/components/builder/blocks/usePastEvents";
import type { BlockDefinition } from "~/contracts/blocks";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";

export const definition: BlockDefinition = {
	name: "Past Events",
	componentType: "PastEventsBlock",
	category: "dynamic",
	icon: "🕰️",
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
	const year = new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(
		start,
	);

	if (!endDate) return `${day} ${month} ${year}`;

	return `${day} ${month} ${year}`;
}

export default component$(() => {
	const { events, nextCursor, isLoading, isLoadingMore, error, loadMore } =
		usePastEvents();

	return (
		<div class="max-w-6xl mx-auto px-4 py-12">
			{isLoading.value ? (
				<div class="text-center py-12">
					<p class="text-text-muted">Loading past events...</p>
				</div>
			) : error.value ? (
				<p class="text-error text-center py-8">
					Failed to load past events: {error.value}
				</p>
			) : events.value.length === 0 ? (
				<p class="text-text-muted text-center py-8">No past events found.</p>
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
									label="View Details"
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

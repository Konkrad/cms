import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";
import { useUpcomingEvents } from "~/modules/events/useUpcomingEvents";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";
import { formatEventWhen } from "~theme/shared/format-event-when";

export const definition: BlockDefinition = {
	name: t("theme.blocks.upcomingEvents.upcomingEvents"),
	componentType: "UpcomingEventsBlock",
	category: "dynamic",
	icon: "📅",
	configSchema: [],
	defaultData: {},
};

export default component$(() => {
	const { events, nextCursor, isLoading, isLoadingMore, error, loadMore } =
		useUpcomingEvents();

	return (
		<div class="max-w-6xl mx-auto px-4 py-12">
			{isLoading.value ? (
				<div class="text-center py-12">
					<p class="text-text-muted">
						{t("theme.upcomingEventsBlock.loadingUpcomingEvents")}
					</p>
				</div>
			) : error.value ? (
				<p class="text-error text-center py-8">
					{t("theme.upcomingEventsBlock.failedToLoadEvents", {
						value: error.value,
					})}
				</p>
			) : events.value.length === 0 ? (
				<p class="text-text-muted text-center py-8">
					{t("theme.upcomingEventsBlock.noUpcomingEvents")}
				</p>
			) : (
				<>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{events.value.map((event) => {
							const location =
								event.city ||
								event.address ||
								(event.locationType === "online"
									? t("theme.upcomingEventsBlock.online")
									: t("theme.upcomingEventsBlock.tba"));
							return (
								<ContentCard
									key={event.id}
									title={event.title}
									image={event.image1}
									date={formatEventWhen(event.startDate, event.endDate)}
									meta={location}
									description={event.body
										?.replace(/<[^>]+>/g, "")
										.substring(0, 180)}
									href={event.url}
									label={t("theme.upcomingEventsBlock.openTickets")}
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
								{isLoadingMore.value
									? t("theme.upcomingEventsBlock.loading")
									: t("theme.upcomingEventsBlock.loadMore")}
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
});

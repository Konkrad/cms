import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { formatDate, t } from "~/contracts/i18n";
import { usePastEvents } from "~/modules/events/usePastEvents";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";

export const definition: BlockDefinition = {
	name: t("theme.blocks.pastEvents.pastEvents"),
	componentType: "PastEventsBlock",
	category: "dynamic",
	icon: "🕰️",
	configSchema: [],
	defaultData: {},
};

export default component$(() => {
	const { events, nextCursor, isLoading, isLoadingMore, error, loadMore } =
		usePastEvents();

	return (
		<div class="max-w-6xl mx-auto px-4 py-12">
			{isLoading.value ? (
				<div class="text-center py-12">
					<p class="text-text-muted">
						{t("theme.pastEventsBlock.loadingPastEvents")}
					</p>
				</div>
			) : error.value ? (
				<p class="text-error text-center py-8">
					{t("theme.pastEventsBlock.failedToLoadPastEvents", {
						value: error.value,
					})}
				</p>
			) : events.value.length === 0 ? (
				<p class="text-text-muted text-center py-8">
					{t("theme.pastEventsBlock.noPastEventsFound")}
				</p>
			) : (
				<>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{events.value.map((event) => {
							const location =
								event.city ||
								event.address ||
								(event.locationType === "online"
									? t("theme.pastEventsBlock.online")
									: t("theme.pastEventsBlock.tba"));
							return (
								<ContentCard
									key={event.id}
									title={event.title}
									image={event.image1}
									date={formatDate(event.startDate, "dateLong")}
									meta={location}
									description={event.body
										?.replace(/<[^>]+>/g, "")
										.substring(0, 180)}
									href={event.url}
									label={t("theme.pastEventsBlock.viewDetails")}
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
									? t("theme.pastEventsBlock.loading")
									: t("theme.pastEventsBlock.loadMore")}
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
});

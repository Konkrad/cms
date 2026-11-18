import { component$ } from "@qwik.dev/core";
import { t } from "~/contracts/i18n";
import type { ScopeEventsData } from "~/contracts/scopes";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";
import { formatEventWhen } from "~theme/shared/format-event-when";

/** The events section of a scope home page (events module, `scopePage.sections` slot). */
export const ScopeEvents = component$<{ data: ScopeEventsData }>(
	({ data: { upcomingEvents, pastEventCount } }) => (
		<div class="max-w-[1290px] mx-auto px-4 py-8" data-testid="scope-events">
			{upcomingEvents.length > 0 && (
				<>
					<h2 class="font-semibold text-[32px] text-text-heading mb-6">
						{t("theme.scope.upcomingCommunityEvents")}
					</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{upcomingEvents.map((e) => {
							const location =
								e.city ||
								e.address ||
								(e.locationType === "online"
									? t("theme.scope.online")
									: t("theme.scope.tba"));
							return (
								<ContentCard
									key={e.id}
									category={e.source ?? undefined}
									title={e.title}
									image={e.image1 ?? undefined}
									date={formatEventWhen(e.startDate, e.endDate)}
									meta={location}
									href={e.url}
									label={t("theme.scope.openTickets")}
								/>
							);
						})}
					</div>
				</>
			)}
			<p class="mt-6 text-text-secondary">
				{t("theme.scope.meetUpsAndCounting", { count: pastEventCount })}
			</p>
		</div>
	),
);

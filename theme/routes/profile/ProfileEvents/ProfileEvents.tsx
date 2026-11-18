import { component$ } from "@qwik.dev/core";
import { formatDate, t } from "~/contracts/i18n";
import type { ProfileEventEntry } from "~/contracts/profile";

const EventList = component$<{ events: ProfileEventEntry[]; empty: string }>(
	({ events, empty }) =>
		events.length === 0 ? (
			<p class="text-text-muted text-sm">{empty}</p>
		) : (
			<ul class="space-y-2">
				{events.map((e) => (
					<li key={e.id}>
						<a
							href={e.url}
							class="block p-4 rounded-xl border border-border hover:border-border-strong hover:bg-bg transition-colors"
						>
							<p class="font-medium text-text-heading">{e.title}</p>
							<p class="text-sm text-text-muted mt-0.5">
								{formatDate(e.startDate)}
								{(e.city || e.country) && (
									<> · {[e.city, e.country].filter(Boolean).join(", ")}</>
								)}
							</p>
						</a>
					</li>
				))}
			</ul>
		),
);

/** The events a user said "yes" to, upcoming and past (events module, profile slots). */
export const ProfileEvents = component$<{
	upcoming: ProfileEventEntry[];
	past: ProfileEventEntry[];
}>(({ upcoming, past }) => (
	<>
		<section data-testid="profile-upcoming-events">
			<h2 class="text-xl font-semibold text-text mb-3">
				{t("theme.userProfile.upcomingEvents")}
			</h2>
			<EventList
				events={upcoming}
				empty={t("theme.userProfile.noUpcomingEvents")}
			/>
		</section>
		<section data-testid="profile-past-events">
			<h2 class="text-xl font-semibold text-text mb-3">
				{t("theme.userProfile.pastEvents")}
			</h2>
			<EventList
				events={past}
				empty={t("theme.userProfile.noPastEventsAttended")}
			/>
		</section>
	</>
));

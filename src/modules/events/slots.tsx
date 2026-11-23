import { component$ } from "@qwik.dev/core";
import type { SlotComponents, SlotProps } from "~/contracts/slots";
import { useSubmitRequirement } from "~/core/setup-actions";
import {
	Alert,
	Button,
	DemographicsBars,
	HomesBars,
	monthRows,
	StatBars,
	StatTile,
	t,
} from "~/core/ui";
import { ProfileEvents } from "~theme/routes/profile/ProfileEvents/ProfileEvents";
import { ScopeEvents } from "~theme/routes/scopes/ScopeEvents";
import { RequirementStep } from "~theme/shared/RequirementStep/RequirementStep";
import {
	useDashboardEvents,
	useEventSettings,
	useProfileEvents,
	useScopeEventStatistics,
	useScopeEvents,
} from "./useEventsSlots";

/** `profile.sections`: the events the viewer said "yes" to. */
const OwnProfileEvents = component$<SlotProps["profile.sections"]>(() => {
	const data = useProfileEvents();
	return data.value ? (
		<ProfileEvents upcoming={data.value.upcoming} past={data.value.past} />
	) : null;
});

/** `userPage.sections`: the events another user said "yes" to. */
const UserPageEvents = component$<SlotProps["userPage.sections"]>(
	({ userId }) => {
		const data = useProfileEvents(userId);
		return data.value ? (
			<ProfileEvents upcoming={data.value.upcoming} past={data.value.past} />
		) : null;
	},
);

/** `profile.settings`: food preference and photo consent, changeable at any time. */
const EventSettings = component$<SlotProps["profile.settings"]>(() => {
	const steps = useEventSettings();
	const action = useSubmitRequirement();
	if (steps.value.length === 0) return null;
	const saved =
		action.value && "success" in action.value && action.value.success
			? action.value.requirementId
			: null;
	return (
		<section
			class="border-l-4 border-info-border bg-info-bg/40 rounded-r-lg pl-4 py-4 space-y-4"
			data-testid="event-settings"
		>
			<h2 class="text-xl font-semibold text-text">
				{t("events.slots.eventSettings")}
			</h2>
			{steps.value.map((step) => (
				<div key={step.id} class="space-y-2">
					<RequirementStep
						step={step}
						action={action}
						submitLabel={t("events.slots.save")}
					/>
					{saved === step.id && (
						<Alert variant="success">{t("events.slots.saved")}</Alert>
					)}
				</div>
			))}
		</section>
	);
});

/** `scopePage.sections`: the scope's next events and its finished-event count. */
const ScopeEventsSection = component$<SlotProps["scopePage.sections"]>(
	({ scopeId }) => {
		const data = useScopeEvents(scopeId);
		return data.value ? <ScopeEvents data={data.value} /> : null;
	},
);

/** `admin.dashboard.widgets`: the scope's (subtree's) event count and a "new event" link. */
const DashboardEvents = component$<SlotProps["admin.dashboard.widgets"]>(
	({ adminBase }) => {
		const data = useDashboardEvents();
		if (!data.value) return null;
		return (
			<div
				class="bg-white rounded-lg shadow-sm p-6"
				data-testid="dashboard-events"
			>
				<div class="text-sm text-gray-600 mb-1">
					{data.value.isRoot
						? t("events.slots.totalEvents")
						: t("events.slots.groupEvents")}
				</div>
				<div class="text-3xl font-bold text-green-600">{data.value.count}</div>
				<div class="mt-3">
					<Button href={`${adminBase}/events/new`} variant="secondary">
						{t("events.slots.newEvent")}
					</Button>
				</div>
			</div>
		);
	},
);

/**
 * `admin.statistics.sections`: whether the scope's members come to events (recently, lost, never;
 * chapter or global events, in person or online), then the events of the scope and below and who came.
 */
const StatisticsEvents = component$<SlotProps["admin.statistics.sections"]>(
	() => {
		const data = useScopeEventStatistics();
		const s = data.value;
		if (!s) return null;
		return (
			<section class="space-y-4" data-testid="statistics-events">
				<h3 class="text-lg font-semibold text-gray-900">
					{t("events.statistics.title")}
				</h3>
				<p class="text-sm text-gray-600">
					{t("events.statistics.membersIntro")}
				</p>
				<div
					class="grid grid-cols-2 md:grid-cols-4 gap-4"
					data-testid="statistics-members-activity"
				>
					<StatTile
						label={t("events.statistics.active")}
						value={s.lastCame.within3Months + s.lastCame.within6Months}
						hint={t("events.statistics.activeHint")}
					/>
					<StatTile
						label={t("events.statistics.lost")}
						value={s.lastCame.within12Months + s.lastCame.longerAgo}
						hint={t("events.statistics.lostHint")}
					/>
					<StatTile
						label={t("events.statistics.neverCame")}
						value={s.lastCame.never}
					/>
					<StatTile
						label={t("events.statistics.noShows")}
						value={s.ticketsIssued - s.ticketsScanned}
						hint={t("events.statistics.ofIssued", { count: s.ticketsIssued })}
					/>
				</div>
				<div class="grid gap-4 md:grid-cols-3">
					<StatBars
						title={t("events.statistics.lastCame")}
						rows={[
							{
								label: t("events.statistics.within3Months"),
								count: s.lastCame.within3Months,
							},
							{
								label: t("events.statistics.within6Months"),
								count: s.lastCame.within6Months,
							},
							{
								label: t("events.statistics.within12Months"),
								count: s.lastCame.within12Months,
							},
							{
								label: t("events.statistics.longerAgo"),
								count: s.lastCame.longerAgo,
							},
							{
								label: t("events.statistics.never"),
								count: s.lastCame.never,
							},
						]}
					/>
					<StatBars
						title={t("events.statistics.eventKinds")}
						rows={[
							{
								label: t("events.statistics.chapterOnly"),
								count: s.eventKinds.chapterOnly,
							},
							{
								label: t("events.statistics.globalOnly"),
								count: s.eventKinds.globalOnly,
							},
							{
								label: t("events.statistics.both"),
								count: s.eventKinds.both,
							},
							{
								label: t("events.statistics.never"),
								count: s.eventKinds.never,
							},
						]}
					/>
					<StatBars
						title={t("events.statistics.formats")}
						rows={[
							{
								label: t("events.statistics.inPersonOnly"),
								count: s.formats.inPersonOnly,
							},
							{
								label: t("events.statistics.onlineOnly"),
								count: s.formats.onlineOnly,
							},
							{
								label: t("events.statistics.both"),
								count: s.formats.both,
							},
							{
								label: t("events.statistics.never"),
								count: s.formats.never,
							},
						]}
					/>
				</div>
				<div class="grid gap-4 md:grid-cols-3">
					<StatBars
						title={t("events.statistics.eventsPerMonth")}
						rows={monthRows(s.eventsPerMonth)}
					/>
					<StatBars
						title={t("events.statistics.attendeesPerMonth")}
						rows={monthRows(s.attendeesPerMonth)}
					/>
					<StatBars
						title={t("events.statistics.visits")}
						rows={[
							{ label: t("events.statistics.once"), count: s.visits.once },
							{
								label: t("events.statistics.twoToFour"),
								count: s.visits.twoToFour,
							},
							{
								label: t("events.statistics.fivePlus"),
								count: s.visits.fivePlus,
							},
						]}
					/>
				</div>
				<h4 class="text-base font-semibold text-gray-900">
					{t("events.statistics.whoCame")}
				</h4>
				<DemographicsBars demographics={s.whoCame} />
				<HomesBars homes={s.homes} />
			</section>
		);
	},
);

/** The events module's slot components (manifest `slots`; listed in the client-safe registry). */
export const eventsSlots: SlotComponents = {
	"profile.sections": OwnProfileEvents,
	"profile.settings": EventSettings,
	"userPage.sections": UserPageEvents,
	"scopePage.sections": ScopeEventsSection,
	"admin.dashboard.widgets": DashboardEvents,
	"admin.statistics.sections": StatisticsEvents,
};

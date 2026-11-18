import { component$ } from "@qwik.dev/core";
import type { SlotComponents, SlotProps } from "~/contracts/slots";
import { useSubmitRequirement } from "~/core/setup-actions";
import { Alert, Button, t } from "~/core/ui";
import { ProfileEvents } from "~theme/routes/profile/ProfileEvents/ProfileEvents";
import { ScopeEvents } from "~theme/routes/scopes/ScopeEvents";
import { RequirementStep } from "~theme/shared/RequirementStep/RequirementStep";
import {
	useDashboardEvents,
	useEventSettings,
	useProfileEvents,
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

/** The events module's slot components (manifest `slots`; listed in the client-safe registry). */
export const eventsSlots: SlotComponents = {
	"profile.sections": OwnProfileEvents,
	"profile.settings": EventSettings,
	"userPage.sections": UserPageEvents,
	"scopePage.sections": ScopeEventsSection,
	"admin.dashboard.widgets": DashboardEvents,
};

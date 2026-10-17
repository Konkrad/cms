import { forms, notify } from "~/core";
import { eventsService } from "./services/events";

/**
 * Event debriefs (spec 5.2). A daily schedule asks the organiser of each event that ended to
 * fill in the active `events.debrief` form: one notification, one reminder a week later,
 * tracked on the event so neither repeats. Nothing else is blocked; admins see overdue
 * debriefs in the events list. Server-only.
 */

export const DEBRIEF_PURPOSE = "events.debrief";
const DAY_MS = 86_400_000;
/** The reminder goes out this long after the request; after that the debrief is overdue. */
export const DEBRIEF_REMINDER_MS = 7 * DAY_MS;
/** Events that ended longer ago than this when the schedule first sees them are not asked. */
export const DEBRIEF_WINDOW_MS = 30 * DAY_MS;

const refOf = (id: string) => `events:event:${id}`;

/** One run of the `debrief-requests` schedule. */
export async function runDebriefRequests({ now }: { now: Date }): Promise<{
	requested: string[];
	reminded: string[];
}> {
	const result = { requested: [] as string[], reminded: [] as string[] };
	const candidates = await eventsService.listDebriefCandidates(
		now,
		new Date(now.getTime() - DEBRIEF_WINDOW_MS),
		new Date(now.getTime() - DEBRIEF_REMINDER_MS),
	);
	for (const event of candidates) {
		if (await forms.hasResult(refOf(event.id), DEBRIEF_PURPOSE)) continue;
		// No debrief form for this scope: nothing to ask for.
		if (!(await forms.active({ scopeId: event.scopeId }, DEBRIEF_PURPOSE)))
			continue;
		const reminder = !!event.debriefRequestedAt;
		const claimed = reminder
			? await eventsService.claimDebriefReminder(event.id, now)
			: await eventsService.claimDebriefRequest(event.id, now);
		if (!claimed) continue;
		await notify("events.debrief-requested", {
			to: event.userId,
			data: { eventId: event.id, reminder },
		});
		(reminder ? result.reminded : result.requested).push(event.id);
	}
	return result;
}

/** Events in these scopes (null = all) whose debrief was asked for a week ago and is still missing. */
export async function listOverdueDebriefs(
	scopeIds: string[] | null,
	now: Date = new Date(),
) {
	const asked = await eventsService.listDebriefsRequestedBefore(
		scopeIds,
		new Date(now.getTime() - DEBRIEF_REMINDER_MS),
	);
	const missing = await Promise.all(
		asked.map(
			async (e) => !(await forms.hasResult(refOf(e.id), DEBRIEF_PURPOSE)),
		),
	);
	return asked.filter((_, i) => missing[i]);
}

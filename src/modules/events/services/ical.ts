import ics, { type DateArray } from "ics";
import { htmlToDescription } from "~/core/seo";
import type { Event } from "../schema/events";

/** Date as UTC components; paired with `startInputType: "utc"` so the server's time zone never matters. */
const utcDateArray = (value: string): DateArray => {
	const d = new Date(value);
	return [
		d.getUTCFullYear(),
		d.getUTCMonth() + 1,
		d.getUTCDate(),
		d.getUTCHours(),
		d.getUTCMinutes(),
	];
};

export const icalService = {
	/**
	 * Calendar entry for an event. The UID is stable per event, so a second ticket email updates
	 * the same entry in the recipient's calendar instead of adding a duplicate.
	 */
	generateEventIcs(event: Event, eventUrl: string): string {
		const { error, value } = ics.createEvent({
			uid: `event-${event.id}@${new URL(eventUrl).host}`,
			title: event.title,
			start: utcDateArray(event.startDate),
			end: utcDateArray(event.endDate),
			startInputType: "utc",
			startOutputType: "utc",
			endInputType: "utc",
			endOutputType: "utc",
			location: event.address || event.onlineUrl || "",
			// The body is rich HTML; calendar descriptions are plain text.
			description: htmlToDescription(event.body, 2000),
			url: eventUrl,
		});

		if (error || !value)
			throw error ?? new Error("Could not create iCal entry");
		return value;
	},
};

import { describe, expect, it } from "vitest";
import type { Event } from "~/modules/events/schema";
import { icalService } from "~/modules/events/services/ical";

const event = {
	id: "evt-1",
	title: "Summer BBQ",
	startDate: "2026-07-01T16:30:00.000Z",
	endDate: "2026-07-01T20:00:00.000Z",
	address: "Main St 1, Berlin",
	onlineUrl: null,
	body: "<p>Bring <strong>food</strong> &amp; friends</p>",
} as unknown as Event;

describe("icalService.generateEventIcs", () => {
	const ics = icalService.generateEventIcs(
		event,
		"https://example.org/events/evt-1",
	);

	it("writes the event times in UTC, independent of the server time zone", () => {
		expect(ics).toContain("DTSTART:20260701T163000Z");
		expect(ics).toContain("DTEND:20260701T200000Z");
	});

	it("uses a stable UID per event and links back to the event page", () => {
		expect(ics).toContain("UID:event-evt-1@example.org");
		expect(ics).toContain("URL:https://example.org/events/evt-1");
	});

	it("turns the rich-text body into a plain-text description", () => {
		const description = ics.match(/DESCRIPTION:(.*)/)?.[1] ?? "";
		expect(description).not.toContain("<");
		expect(description).toContain("food");
	});
});

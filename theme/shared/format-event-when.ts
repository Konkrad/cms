import { formatDate } from "~/contracts/i18n";

/** "12 October · 18:00 – 21:00": an event's day and times in the site locale. */
export function formatEventWhen(startDate: string, endDate?: string): string {
	const day = `${formatDate(startDate, "dayMonth")} · ${formatDate(startDate, "time")}`;
	return endDate ? `${day} – ${formatDate(endDate, "time")}` : day;
}

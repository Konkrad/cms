import ics from "ics";
import type { Event } from "~/db/schemas/events";

export const icalService = {
  generateEventIcs(event: Event): string {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    const { error, value } = ics.createEvent({
      title: event.title,
      start: [
        start.getFullYear(),
        start.getMonth() + 1,
        start.getDate(),
        start.getHours(),
        start.getMinutes(),
      ],
      end: [
        end.getFullYear(),
        end.getMonth() + 1,
        end.getDate(),
        end.getHours(),
        end.getMinutes(),
      ],
      location: event.address || event.onlineUrl || "",
      description: event.body,
    });

    if (error) throw error;
    return value!;
  },
};

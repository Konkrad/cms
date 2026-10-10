/**
 * Core → theme data contracts for the public event detail route
 * (`/events/[id]`), and for the core-owned events-block composables
 * (`~modules/events/useUpcomingEvents`, `usePastEvents`).
 */

import type { useEvent, useUpdateParticipation } from "~/routes/events/[id]";
import type { Event } from "~modules/events/schema/events";

export type EventViewData = ReturnType<typeof useEvent>["value"];
export type UpdateParticipationAction = ReturnType<
	typeof useUpdateParticipation
>;

/** Event shape returned by the events-block composables — `image1` resolved to a public URL. */
export type BlockEvent = Omit<Event, "image1"> & { image1: string | null };

export type EventsPage = { events: BlockEvent[]; nextCursor: string | null };

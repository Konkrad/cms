/**
 * Core → theme data contracts for the public event detail route
 * (`/events/[id]`), and for the core-owned events-block composables
 * (`~/components/builder/blocks/useUpcomingEvents`, `usePastEvents`).
 */

import type { Event } from "~/db/schemas/events";
import type { useEvent, useUpdateParticipation } from "~/routes/events/[id]";

export type EventViewData = ReturnType<typeof useEvent>["value"];
export type UpdateParticipationAction = ReturnType<
	typeof useUpdateParticipation
>;

/** Event shape returned by the events-block composables — `image1` resolved to a public URL. */
export type BlockEvent = Omit<Event, "image1"> & { image1: string | null };

export type EventsPage = { events: BlockEvent[]; nextCursor: string | null };

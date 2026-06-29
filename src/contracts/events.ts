/**
 * Core → theme data contracts for the public event detail route
 * (`/events/[id]`).
 */
import type { useEvent, useUpdateParticipation } from "~/routes/events/[id]";

export type EventViewData = ReturnType<typeof useEvent>["value"];
export type UpdateParticipationAction = ReturnType<typeof useUpdateParticipation>;

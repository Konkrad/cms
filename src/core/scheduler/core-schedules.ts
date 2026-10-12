import type { ScheduleDefinition } from "~/core/scheduler/define";

/**
 * Recurring jobs of core itself (same shape as a manifest's `schedules`), e.g. a payments
 * expiry job (spec 4.7) once checkouts are tracked in core.
 */
export const coreSchedules: ScheduleDefinition[] = [];

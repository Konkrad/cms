import { z } from "zod";

/**
 * Deployment settings of the events module, read as `moduleSettings("events")`. Environment
 * variables `EVENTS_<KEY>`: `EVENTS_ENGAGEMENT_WINDOW`, `EVENTS_CORE_PERCENT`,
 * `EVENTS_REGULAR_PERCENT`. Pure (zod only): src/env.ts validates it at startup while the
 * module is active.
 */
export const eventsSettings = z.object({
	/**
	 * Statistics: how many of the most recent events a person could have attended (their
	 * chapters' events and global ones) decide how engaged they are.
	 */
	engagementWindow: z.coerce.number().int().min(3).max(100).default(12),
	/** Core: came to at least this share (%) of those events. */
	corePercent: z.coerce.number().int().min(1).max(100).default(50),
	/** Regular: came to at least this share (%), below core. */
	regularPercent: z.coerce.number().int().min(1).max(100).default(25),
	/** New: fewer events they could attend so far than this; not rated yet. */
	engagementMinEvents: z.coerce.number().int().min(1).max(100).default(4),
});

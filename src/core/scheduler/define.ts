/**
 * Recurring jobs (manifest `schedules`, spec 4.1). Client-safe (types and pure functions).
 * Core runs the schedules of core and the ACTIVE modules in the server process; each run is
 * recorded in `schedule_runs`, which also locks it, so a schedule never runs twice at once nor
 * more often than `every`, across restarts and server instances.
 */

/** What a run receives. */
export interface ScheduleContext {
	/** The time of this tick (use it instead of `new Date()` so runs are testable). */
	now: Date;
}

export interface ScheduleDefinition {
	/** Unique within its module (`debrief-requests`); core keys it as `<module>.<id>`. */
	id: string;
	/** How often: milliseconds, or `"<n>m"`, `"<n>h"`, `"<n>d"` ("1d" = daily). */
	every: number | `${number}${"m" | "h" | "d"}`;
	/**
	 * The job. Server-only. Throwing marks the run failed (listed in the admin failure view)
	 * and retries it after a backoff; a run must be safe to repeat.
	 */
	run(ctx: ScheduleContext): Promise<void>;
}

const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** `every` in milliseconds; throws on a malformed or non-positive interval. */
export function everyMs(every: ScheduleDefinition["every"]): number {
	if (typeof every === "number") {
		if (!Number.isFinite(every) || every <= 0)
			throw new Error(`Invalid schedule interval: ${every}`);
		return every;
	}
	const match = /^(\d+)([mhd])$/.exec(every);
	if (!match || Number(match[1]) <= 0)
		throw new Error(`Invalid schedule interval: ${every}`);
	return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}

/** A schedule with its owner, as the scheduler runs it. */
export interface RegisteredSchedule {
	/** `<owner>.<id>`, the `schedule_runs` key. */
	key: string;
	everyMs: number;
	run: ScheduleDefinition["run"];
}

const ID_PATTERN = /^[a-z0-9-]+$/;

/** Keys and validates schedules by owner (`core` or a module id); throws on duplicates. */
export function registerSchedules(
	owners: ReadonlyArray<{
		id: string;
		schedules?: readonly ScheduleDefinition[];
	}>,
): RegisteredSchedule[] {
	const seen = new Set<string>();
	return owners.flatMap((owner) =>
		(owner.schedules ?? []).map((s) => {
			if (!ID_PATTERN.test(s.id))
				throw new Error(
					`Schedule id "${s.id}" must be lowercase letters, digits and -`,
				);
			const key = `${owner.id}.${s.id}`;
			if (seen.has(key)) throw new Error(`Duplicate schedule: ${key}`);
			seen.add(key);
			return { key, everyMs: everyMs(s.every), run: s.run };
		}),
	);
}

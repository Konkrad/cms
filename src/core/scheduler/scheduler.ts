import type { RegisteredSchedule } from "~/core/scheduler/define";
import { scheduleRunsService } from "~/core/scheduler/schedule-runs.service";

/** A run is assumed dead (the process crashed) when it holds its lease this long. */
export const SCHEDULE_LEASE_MS = 30 * 60 * 1000;
const RETRY_BASE_MS = 60_000;
const MAX_ERROR_LENGTH = 1000;

/** Delay before retrying a failed run: 1m, 2m, 4m … capped at the schedule's own interval. */
export const scheduleRetryMs = (failures: number, every: number): number =>
	Math.min(RETRY_BASE_MS * 2 ** Math.max(0, failures - 1), every);

export interface RunSchedulesResult {
	ran: string[];
	failed: string[];
}

/**
 * One scheduler tick: runs every due schedule this process can claim, one after the other.
 * A schedule runs at most once per `every` (the next run is planned from this tick), never
 * concurrently (the claim takes a lease), and a failure is recorded and retried with backoff.
 */
export async function runDueSchedules(
	schedules: readonly RegisteredSchedule[],
	now: Date = new Date(),
): Promise<RunSchedulesResult> {
	const result: RunSchedulesResult = { ran: [], failed: [] };
	await scheduleRunsService.ensure(
		schedules.map((s) => s.key),
		now,
	);
	for (const schedule of schedules) {
		if (
			!(await scheduleRunsService.claim(schedule.key, now, SCHEDULE_LEASE_MS))
		)
			continue;
		try {
			await schedule.run({ now });
		} catch (error) {
			const message = (
				error instanceof Error ? error.message : String(error)
			).slice(0, MAX_ERROR_LENGTH);
			const failures =
				((await scheduleRunsService.get(schedule.key))?.failures ?? 0) + 1;
			await scheduleRunsService.markFailed(
				schedule.key,
				now,
				message,
				failures,
				new Date(now.getTime() + scheduleRetryMs(failures, schedule.everyMs)),
			);
			result.failed.push(schedule.key);
			continue;
		}
		await scheduleRunsService.markOk(
			schedule.key,
			now,
			new Date(now.getTime() + schedule.everyMs),
		);
		result.ran.push(schedule.key);
	}
	return result;
}

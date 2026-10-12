import { runDueSchedules } from "~/core/scheduler/scheduler";
import { env } from "~/env";

const WORKER_KEY = Symbol.for("cms.scheduler.worker");

/**
 * One tick of core's background work besides notifications: due schedules of core and the
 * active modules. Lazy registry import: it loads every module manifest.
 */
export async function schedulerTick(now: Date = new Date()): Promise<void> {
	const { activeSchedules } = await import("~/core/registry/schedules");
	await runDueSchedules(activeSchedules(), now);
}

/**
 * Starts the scheduler loop once per process (like the outbox worker): ticks never overlap, a
 * broken tick is logged and the next one retries. Not started under NODE_ENV=test.
 */
export function startScheduler(
	intervalMs: number = env.SCHEDULER_POLL_INTERVAL_MS,
): void {
	if (env.NODE_ENV === "test") return;
	const store = globalThis as { [WORKER_KEY]?: ReturnType<typeof setInterval> };
	if (store[WORKER_KEY]) return;

	let running = false;
	const tick = async () => {
		if (running) return;
		running = true;
		try {
			await schedulerTick();
		} catch (error) {
			console.error("Scheduler tick failed:", error);
		} finally {
			running = false;
		}
	};
	const timer = setInterval(tick, intervalMs);
	timer.unref();
	store[WORKER_KEY] = timer;
}

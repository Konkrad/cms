import { handlerCallsService } from "~/core/scheduler/handler-calls.service";
import type { HandlerCall } from "~/core/scheduler/schema";

const BATCH_SIZE = 20;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 60 * 60 * 1000;
const MAX_ERROR_LENGTH = 1000;

/** Delay before the next attempt: 30s, 1m, 2m … capped at 1h; calls are retried until they succeed. */
export const handlerBackoffMs = (attempts: number): number =>
	Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);

/** Finds the function a row names, or undefined when the owner no longer declares it. */
export type HandlerResolver = (
	call: Pick<HandlerCall, "owner" | "kind" | "type" | "hook">,
) => ((payload: Record<string, unknown>) => Promise<void>) | undefined;

export interface ProcessHandlerCallsResult {
	done: number;
	retried: number;
}

/**
 * One tick: runs due handler calls and marks them done, or schedules a retry with backoff.
 * A call whose handler is not declared (yet) is retried too, so it shows up in the failure
 * view instead of disappearing.
 */
export async function processHandlerCallsOnce(
	resolve: HandlerResolver,
	now: Date = new Date(),
): Promise<ProcessHandlerCallsResult> {
	const result: ProcessHandlerCallsResult = { done: 0, retried: 0 };
	for (const call of await handlerCallsService.claimDue(now, BATCH_SIZE)) {
		const attempts = call.attempts + 1;
		try {
			const handler = resolve(call);
			if (!handler)
				throw new Error(
					`No ${call.hook} handler for ${call.owner} ${call.kind} "${call.type}"`,
				);
			await handler(call.payload);
		} catch (error) {
			const message = (
				error instanceof Error ? error.message : String(error)
			).slice(0, MAX_ERROR_LENGTH);
			await handlerCallsService.markRetry(
				call.id,
				attempts,
				message,
				new Date(now.getTime() + handlerBackoffMs(attempts)),
			);
			result.retried++;
			continue;
		}
		await handlerCallsService.markDone(call.id, attempts, now);
		result.done++;
	}
	return result;
}

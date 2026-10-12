import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { notificationOutboxService } from "~/core/notifications/outbox.service";
import { scheduleRunsService } from "~/core/scheduler/schedule-runs.service";
import { requireSystemAdmin } from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

/** Failed and pending notification outbox rows (platform admin only, global admin). */
export const useUndeliveredNotifications = routeLoader$(async (event) => {
	await requireSystemAdmin(event);
	const rows = await notificationOutboxService.listUndeliveredWithAddress();
	// Scheduled jobs (manifest `schedules`) whose last run failed; they retry with backoff.
	const schedules = await scheduleRunsService.listFailing();
	return assertNoPrivateFields(
		{ rows, schedules },
		{
			// Platform admins diagnose delivery failures: they need to see where a message
			// was going (the email address or chat id resolved for the recipient).
			allow: ["recipientAddress"],
		},
	);
});

/** Re-queues a failed (or waiting) row for an immediate send with a fresh attempt budget. */
export const useRetryNotification = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);
		const requeued = await notificationOutboxService.requeue(
			data.id,
			new Date(),
		);
		if (!requeued) return event.fail(404, { message: "Row not found" });
		return { success: true };
	},
	zod$({ id: z.string().uuid() }),
);

/** Runs a failing schedule again at the next scheduler tick. */
export const useRunScheduleNow = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);
		if (!(await scheduleRunsService.runSoon(data.key, new Date())))
			return event.fail(404, { message: "Schedule not found" });
		return { success: true };
	},
	zod$({ key: z.string().min(1) }),
);

const formatDate = (iso: string) => new Date(iso).toLocaleString("en-GB");

export default component$(() => {
	const data = useUndeliveredNotifications();
	const retry = useRetryNotification();
	const runNow = useRunScheduleNow();
	const rows = data.value.rows;
	const schedules = data.value.schedules;

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">Notifications</h2>
			</div>
			<p class="text-sm text-gray-500 mb-6">
				Messages that have not been delivered yet. Pending rows are retried
				automatically with backoff; failed rows have given up and can be
				re-queued here.
			</p>

			<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
				{rows.length === 0 ? (
					<div class="px-5 py-8 text-center text-gray-400 text-sm">
						Nothing failed or waiting.
					</div>
				) : (
					<table class="min-w-full divide-y divide-gray-200 text-sm">
						<thead class="bg-gray-50">
							<tr>
								{[
									"Status",
									"Notification",
									"Channel",
									"Recipient",
									"Attempts",
									"Last error",
									"Next attempt",
									"Created",
									"",
								].map((label) => (
									<th
										key={label}
										class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>
										{label}
									</th>
								))}
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{rows.map((row) => (
								<tr key={row.id} data-outbox-id={row.id}>
									<td class="px-4 py-3">
										<span
											class={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
												row.status === "failed"
													? "bg-red-100 text-red-800"
													: "bg-yellow-100 text-yellow-800"
											}`}
										>
											{row.status}
										</span>
									</td>
									<td class="px-4 py-3 font-mono text-xs">
										{row.notificationId}
									</td>
									<td class="px-4 py-3">{row.channel}</td>
									<td class="px-4 py-3">{row.recipientAddress ?? "—"}</td>
									<td class="px-4 py-3">{row.attempts}</td>
									<td class="px-4 py-3 text-red-700 max-w-xs break-words">
										{row.lastError ?? ""}
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										{row.status === "pending"
											? formatDate(row.nextAttemptAt)
											: "—"}
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										{formatDate(row.createdAt)}
									</td>
									<td class="px-4 py-3">
										<Form action={retry}>
											<input type="hidden" name="id" value={row.id} />
											<button
												type="submit"
												class="text-blue-600 hover:text-blue-800 font-medium"
											>
												Retry
											</button>
										</Form>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			<h3 class="text-xl font-bold text-gray-800 mt-10 mb-2">Scheduled jobs</h3>
			<p class="text-sm text-gray-500 mb-4">
				Recurring jobs whose last run failed. They are retried with backoff;
				"Run now" runs one at the next tick.
			</p>
			<div
				class="bg-white rounded-lg shadow-sm overflow-x-auto"
				data-testid="failing-schedules"
			>
				{schedules.length === 0 ? (
					<div class="px-5 py-8 text-center text-gray-400 text-sm">
						No failing scheduled jobs.
					</div>
				) : (
					<table class="min-w-full divide-y divide-gray-200 text-sm">
						<thead class="bg-gray-50">
							<tr>
								{[
									"Job",
									"Failures",
									"Last error",
									"Last run",
									"Next run",
									"",
								].map((label) => (
									<th
										key={label}
										class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>
										{label}
									</th>
								))}
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{schedules.map((row) => (
								<tr key={row.key} data-schedule-key={row.key}>
									<td class="px-4 py-3 font-mono text-xs">{row.key}</td>
									<td class="px-4 py-3">{row.failures}</td>
									<td class="px-4 py-3 text-red-700 max-w-xs break-words">
										{row.lastError ?? ""}
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										{row.lastRunAt ? formatDate(row.lastRunAt) : "—"}
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										{formatDate(row.nextRunAt)}
									</td>
									<td class="px-4 py-3">
										<Form action={runNow}>
											<input type="hidden" name="key" value={row.key} />
											<button
												type="submit"
												class="text-blue-600 hover:text-blue-800 font-medium"
											>
												Run now
											</button>
										</Form>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
});

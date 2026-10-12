import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { formatDate, t } from "~/core/i18n";
import { notificationOutboxService } from "~/core/notifications/outbox.service";
import { handlerCallsService } from "~/core/scheduler/handler-calls.service";
import { scheduleRunsService } from "~/core/scheduler/schedule-runs.service";
import { requireSystemAdmin } from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

/** Failed and pending notification outbox rows (platform admin only, global admin). */
export const useUndeliveredNotifications = routeLoader$(async (event) => {
	await requireSystemAdmin(event);
	const rows = await notificationOutboxService.listUndeliveredWithAddress();
	// Scheduled jobs (manifest `schedules`) whose last run failed; they retry with backoff.
	const schedules = await scheduleRunsService.listFailing();
	// Handler calls (review decisions) that failed at least once; retried until they succeed.
	const handlers = (await handlerCallsService.listFailing()).map((h) => ({
		id: h.id,
		name: `${h.owner}.${h.kind}.${h.type}.${h.hook}`,
		target: String(h.payload.ref ?? ""),
		attempts: h.attempts,
		lastError: h.lastError,
		nextAttemptAt: h.nextAttemptAt,
	}));
	return assertNoPrivateFields(
		{ rows, schedules, handlers },
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
		if (!requeued)
			return event.fail(404, { message: t("admin.notifications.rowNotFound") });
		return { success: true };
	},
	zod$({ id: z.string().uuid() }),
);

/** Retries a failing handler call at the next scheduler tick. */
export const useRetryHandlerCall = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);
		if (!(await handlerCallsService.retrySoon(data.id, new Date())))
			return event.fail(404, {
				message: t("admin.notifications.callNotFound"),
			});
		return { success: true };
	},
	zod$({ id: z.string().uuid() }),
);

/** Runs a failing schedule again at the next scheduler tick. */
export const useRunScheduleNow = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);
		if (!(await scheduleRunsService.runSoon(data.key, new Date())))
			return event.fail(404, {
				message: t("admin.notifications.scheduleNotFound"),
			});
		return { success: true };
	},
	zod$({ key: z.string().min(1) }),
);

const formatDateTime = (iso: string) => formatDate(iso, "dateTime");

export default component$(() => {
	const data = useUndeliveredNotifications();
	const retry = useRetryNotification();
	const runNow = useRunScheduleNow();
	const retryHandler = useRetryHandlerCall();
	const handlers = data.value.handlers;
	const rows = data.value.rows;
	const schedules = data.value.schedules;

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">
					{t("admin.notifications.notifications")}
				</h2>
			</div>
			<p class="text-sm text-gray-500 mb-6">
				{t("admin.notifications.messagesThatHaveNotBeen")}
			</p>

			<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
				{rows.length === 0 ? (
					<div class="px-5 py-8 text-center text-gray-400 text-sm">
						{t("admin.notifications.nothingFailedOrWaiting")}
					</div>
				) : (
					<table class="min-w-full divide-y divide-gray-200 text-sm">
						<thead class="bg-gray-50">
							<tr>
								{[
									t("admin.notifications.col.status"),
									t("admin.notifications.col.notification"),
									t("admin.notifications.col.channel"),
									t("admin.notifications.col.recipient"),
									t("admin.notifications.col.attempts"),
									t("admin.notifications.col.lastError"),
									t("admin.notifications.col.nextAttempt"),
									t("admin.notifications.col.created"),
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
											? formatDateTime(row.nextAttemptAt)
											: "—"}
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										{formatDateTime(row.createdAt)}
									</td>
									<td class="px-4 py-3">
										<Form action={retry}>
											<input type="hidden" name="id" value={row.id} />
											<button
												type="submit"
												class="text-blue-600 hover:text-blue-800 font-medium"
											>
												{t("admin.notifications.retry")}
											</button>
										</Form>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			<h3 class="text-xl font-bold text-gray-800 mt-10 mb-2">
				{t("admin.notifications.scheduledJobs")}
			</h3>
			<p class="text-sm text-gray-500 mb-4">
				{t("admin.notifications.recurringJobsWhoseLastRun")}
			</p>
			<div
				class="bg-white rounded-lg shadow-sm overflow-x-auto"
				data-testid="failing-schedules"
			>
				{schedules.length === 0 ? (
					<div class="px-5 py-8 text-center text-gray-400 text-sm">
						{t("admin.notifications.noFailingScheduledJobs")}
					</div>
				) : (
					<table class="min-w-full divide-y divide-gray-200 text-sm">
						<thead class="bg-gray-50">
							<tr>
								{[
									t("admin.notifications.col.job"),
									t("admin.notifications.col.failures"),
									t("admin.notifications.col.lastError"),
									t("admin.notifications.col.lastRun"),
									t("admin.notifications.col.nextRun"),
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
										{row.lastRunAt ? formatDateTime(row.lastRunAt) : "—"}
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										{formatDateTime(row.nextRunAt)}
									</td>
									<td class="px-4 py-3">
										<Form action={runNow}>
											<input type="hidden" name="key" value={row.key} />
											<button
												type="submit"
												class="text-blue-600 hover:text-blue-800 font-medium"
											>
												{t("admin.notifications.runNow")}
											</button>
										</Form>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			<h3 class="text-xl font-bold text-gray-800 mt-10 mb-2">
				{t("admin.notifications.handlerCalls")}
			</h3>
			<p class="text-sm text-gray-500 mb-4">
				{t("admin.notifications.moduleAndCoreHandlersReview")}
			</p>
			<div
				class="bg-white rounded-lg shadow-sm overflow-x-auto"
				data-testid="failing-handlers"
			>
				{handlers.length === 0 ? (
					<div class="px-5 py-8 text-center text-gray-400 text-sm">
						{t("admin.notifications.noFailingHandlerCalls")}
					</div>
				) : (
					<table class="min-w-full divide-y divide-gray-200 text-sm">
						<tbody class="divide-y divide-gray-200">
							{handlers.map((row) => (
								<tr key={row.id} data-handler-id={row.id}>
									<td class="px-4 py-3 font-mono text-xs">{row.name}</td>
									<td class="px-4 py-3 font-mono text-xs">{row.target}</td>
									<td class="px-4 py-3">{row.attempts}</td>
									<td class="px-4 py-3 text-red-700 max-w-xs break-words">
										{row.lastError ?? ""}
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										{formatDateTime(row.nextAttemptAt)}
									</td>
									<td class="px-4 py-3">
										<Form action={retryHandler}>
											<input type="hidden" name="id" value={row.id} />
											<button
												type="submit"
												class="text-blue-600 hover:text-blue-800 font-medium"
											>
												{t("admin.notifications.retryNow")}
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

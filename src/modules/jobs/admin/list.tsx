import { component$ } from "@qwik.dev/core";
import { Form, Link, routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireModuleAdmin, requireWithinScope } from "~/core";
import { formatDate, Pagination, SearchBar, t } from "~/core/ui";
import { notifyIfApproved } from "../notifications";
import { jobsService } from "../service";
import type { AdminJobsData } from "./list-data";

export const useApproveJob = routeAction$(
	async (data, event) => {
		const { scope } = await requireModuleAdmin(event, { module: "jobs" });
		const before = await jobsService.getById(data.jobId);
		await requireWithinScope(event, scope, before);
		if (!before)
			return event.fail(404, { message: t("jobs.admin.list.jobNotFound") });
		const after = await jobsService.update(data.jobId, {
			status: "approved",
		} as any);
		await notifyIfApproved(before, after);
		return { success: true };
	},
	zod$({ jobId: z.string().uuid() }),
);

export const useDeleteJob = routeAction$(
	async (data, event) => {
		const { scope } = await requireModuleAdmin(event, { module: "jobs" });
		await requireWithinScope(
			event,
			scope,
			await jobsService.getById(data.jobId),
		);
		await jobsService.delete(data.jobId);
		return { success: true };
	},
	zod$({ jobId: z.string().uuid() }),
);

export const AdminJobsList = component$<{ data: AdminJobsData }>(({ data }) => {
	const approveAction = useApproveJob();
	const deleteAction = useDeleteJob();
	const now = new Date();
	const totalPages = Math.ceil(data.total / data.pageSize);

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">
					{t("jobs.admin.list.jobs")}
				</h2>
			</div>

			<SearchBar
				value={data.search}
				placeholder={t("jobs.admin.list.searchByTitleOrLocation")}
			/>

			<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("jobs.admin.list.job")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("jobs.admin.list.suggestedBy")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("jobs.admin.list.location")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("jobs.admin.list.expires")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("jobs.admin.list.status")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("jobs.admin.list.actions")}
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{data.jobs.map((job) => {
							const isExpired = new Date(job.expiresAt) < now;
							const locationLabel =
								job.locationType === "on-site"
									? [job.city, job.country].filter(Boolean).join(", ") ||
										t("jobs.admin.list.onSiteHybrid")
									: job.locationType === "remote-eu"
										? t("jobs.admin.list.remoteEu")
										: t("jobs.admin.list.remote", { value: job.country ?? "" });

							return (
								<tr key={job.id} class="hover:bg-gray-50">
									<td class="px-6 py-4">
										<div class="text-sm font-medium text-gray-900">
											{job.title}
										</div>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
										{job.user?.name} {job.user?.familyName}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
										{locationLabel}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm">
										<span
											class={
												isExpired ? "text-red-600 font-medium" : "text-gray-700"
											}
										>
											{isExpired ? t("jobs.admin.list.expired") : ""}
											{formatDate(job.expiresAt)}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span
											class={[
												"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
												job.status === "approved"
													? "bg-green-100 text-green-800"
													: "bg-yellow-100 text-yellow-800",
											].join(" ")}
										>
											{job.status === "approved"
												? t("jobs.admin.list.approved")
												: t("jobs.admin.list.pending")}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
										<div class="flex items-center gap-4">
											{job.status === "pending" && (
												<Form action={approveAction}>
													<input type="hidden" name="jobId" value={job.id} />
													<button
														type="submit"
														class="text-green-600 hover:text-green-900"
													>
														{t("jobs.admin.list.approve")}
													</button>
												</Form>
											)}
											<Link
												href={`${data.adminBase}/jobs/${job.id}/edit`}
												class="text-blue-600 hover:text-blue-900"
											>
												{t("jobs.admin.list.edit")}
											</Link>
											<Form action={deleteAction}>
												<input type="hidden" name="jobId" value={job.id} />
												<button
													type="submit"
													preventdefault:click
													class="text-red-600 hover:text-red-900"
													onClick$={(e) => {
														if (
															!confirm(
																t("jobs.admin.list.deleteThisJobPosting"),
															)
														)
															return;
														(e.target as HTMLElement)
															.closest("form")
															?.requestSubmit();
													}}
												>
													{t("jobs.admin.list.delete")}
												</button>
											</Form>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
				{data.jobs.length === 0 && (
					<div class="text-center py-12 text-gray-500">
						{data.search
							? t("jobs.admin.list.noJobsMatching", { search: data.search })
							: t("jobs.admin.list.noJobPostingsYet")}
					</div>
				)}
				<Pagination
					page={data.page}
					totalPages={totalPages}
					total={data.total}
					pageSize={data.pageSize}
				/>
			</div>
		</div>
	);
});

import { component$ } from "@qwik.dev/core";
import { Form, Link } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { formatDate, t } from "~/contracts/i18n";
import type { DeleteMyJobAction, MyJobsData } from "~/contracts/jobs";

function locationLabel(job: {
	locationType: string;
	city?: string | null;
	country?: string | null;
}) {
	if (job.locationType === "on-site") {
		return [job.city, job.country].filter(Boolean).join(", ") || "On-site";
	}
	if (job.locationType === "remote-eu") return t("theme.myJobs.remoteEu");
	return t("theme.myJobs.remote", { value: job.country ?? "" });
}

/** Themed view for the user's own job submissions (`/jobs/mine`). */
export const MyJobsView = component$<{
	data: MyJobsData;
	deleteAction: DeleteMyJobAction;
}>(({ data, deleteAction }) => {
	return (
		<div class="max-w-3xl mx-auto px-4 py-8">
			<div class="mb-6">
				<Link href="/jobs" class="text-sm text-primary hover:text-primary">
					{t("theme.myJobs.backToJobBoard")}
				</Link>
			</div>

			<div class="flex items-center justify-between mb-8">
				<h1 class="text-2xl font-bold text-text-heading">
					{t("theme.myJobs.myJobSubmissions")}
				</h1>
				<Button href="/jobs/new">{t("theme.myJobs.postAJob")}</Button>
			</div>

			<div class="bg-white border border-border rounded-lg overflow-hidden">
				{data.jobs.length === 0 ? (
					<div class="text-center py-12 text-text-muted">
						{t("theme.myJobs.youHavenTSubmittedAny")}
					</div>
				) : (
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-bg">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
									{t("theme.myJobs.job")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
									{t("theme.myJobs.location")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
									{t("theme.myJobs.expires")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
									{t("theme.myJobs.status")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
									{t("theme.myJobs.actions")}
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{data.jobs.map((job) => {
								const isExpired = new Date(job.expiresAt) < new Date();
								return (
									<tr key={job.id} class="hover:bg-bg">
										<td class="px-6 py-4">
											<div class="text-sm font-medium text-text-heading">
												{job.title}
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
											{locationLabel(job)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm">
											<span
												class={
													isExpired
														? "text-error font-medium"
														: "text-text-secondary"
												}
											>
												{isExpired ? t("theme.myJobs.expired") : ""}
												{formatDate(job.expiresAt)}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span
												class={[
													"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
													job.status === "approved"
														? "bg-success-bg text-success"
														: "bg-warning-bg text-warning",
												].join(" ")}
											>
												{job.status === "approved"
													? t("theme.myJobs.approved")
													: t("theme.myJobs.pendingReview")}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
											<div class="flex items-center gap-4">
												{job.status === "pending" && (
													<Link
														href={`/jobs/mine/${job.id}/edit`}
														class="text-primary hover:text-primary-dark"
													>
														{t("theme.myJobs.edit")}
													</Link>
												)}
												{job.status === "pending" && (
													<Form action={deleteAction}>
														<input type="hidden" name="jobId" value={job.id} />
														<button
															type="submit"
															class="text-error hover:text-error"
															onClick$={(e) => {
																if (
																	!confirm(
																		t("theme.myJobs.deleteThisJobPosting"),
																	)
																) {
																	e.preventDefault();
																}
															}}
														>
															{t("theme.myJobs.delete")}
														</button>
													</Form>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
});

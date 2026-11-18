import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { formatDate, t } from "~/contracts/i18n";
import type { JobDetailData } from "~/contracts/jobs";

function locationLabel(job: {
	locationType: string;
	city?: string | null;
	country?: string | null;
}) {
	if (job.locationType === "on-site") {
		return (
			[job.city, job.country].filter(Boolean).join(", ") || "On-site / Hybrid"
		);
	}
	if (job.locationType === "remote-eu") return t("theme.jobDetail.remoteEu");
	return t("theme.jobDetail.remote", { value: job.country ?? "" });
}

const RELATION_LABELS: Record<string, string> = {
	hiring: t("theme.jobDetail.hiringForThisRole"),
	founder: "founder",
	"direct-team": t("theme.jobDetail.youDBeOnTheir"),
	"works-there": t("theme.jobDetail.worksThere"),
	other: t("theme.jobDetail.communityMember"),
};

/** Themed view for a single job posting (`/jobs/[id]`). */
export const JobDetailView = component$<{ data: JobDetailData }>(({ data }) => {
	const job = data.job;
	const posterName =
		[job.user?.name, job.user?.familyName].filter(Boolean).join(" ") ||
		"A member";
	const relationLabel = job.posterRelation
		? (RELATION_LABELS[job.posterRelation] ?? job.posterRelation)
		: null;

	return (
		<div class="max-w-2xl mx-auto px-4 py-8">
			<div class="mb-6">
				<Link href="/jobs" class="text-sm text-primary hover:text-primary">
					{t("theme.jobDetail.backToJobBoard")}
				</Link>
			</div>

			<div class="bg-white border border-border rounded-lg p-8">
				<h1 class="text-2xl font-bold text-text-heading mb-4">{job.title}</h1>

				<dl class="grid grid-cols-1 gap-2 text-sm mb-6 pb-6 border-b border-border">
					<div class="flex gap-2">
						<dt class="text-text-muted w-24 shrink-0">
							{t("theme.jobDetail.location")}
						</dt>
						<dd class="text-text-heading">{locationLabel(job)}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="text-text-muted w-24 shrink-0">
							{t("theme.jobDetail.postedBy")}
						</dt>
						<dd class="text-text-heading">
							<Link href={`/users/${job.user?.id}`} class="hover:underline">
								{posterName}
							</Link>
							{relationLabel && (
								<span class="text-text-muted"> · {relationLabel}</span>
							)}
						</dd>
					</div>
					<div class="flex gap-2">
						<dt class="text-text-muted w-24 shrink-0">
							{t("theme.jobDetail.listedUntil")}
						</dt>
						<dd class="text-text-heading">{formatDate(job.expiresAt)}</dd>
					</div>
				</dl>

				<div
					class="prose prose-sm max-w-none text-text-secondary"
					dangerouslySetInnerHTML={job.body}
				/>

				{job.link && (
					<div class="mt-8 pt-6 border-t border-border">
						<a
							href={job.link}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center px-6 py-3 text-base font-medium text-white bg-primary rounded-lg hover:bg-primary"
						>
							{t("theme.jobDetail.applyNow")}
						</a>
					</div>
				)}
			</div>
		</div>
	);
});

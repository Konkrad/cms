import { $, component$, useOnWindow, useVisibleTask$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { CursorPager } from "~/components/ui/CursorPager";
import type { JobsListData } from "~/contracts/jobs";
import { useJobsPagination } from "~/routes/jobs/useJobsPagination";

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
	if (job.locationType === "remote-eu") return "Remote — EU";
	return `Remote — ${job.country ?? ""}`;
}

/** Themed view for the job board list (`/jobs`). */
export const JobsListView = component$<{ data: JobsListData }>(({ data }) => {
	const {
		displayedJobs,
		nextCursor,
		prevCursor,
		isLoading,
		loadFromUrl,
		goNext,
		goPrev,
	} = useJobsPagination(data);

	const jobs = displayedJobs.value;

	// Browser back/forward: re-derive the displayed page from the URL.
	useOnWindow(
		"popstate",
		$(() => {
			void loadFromUrl();
		}),
	);

	// Runs on every mount, including a remount after a full route navigation
	// away and back (e.g. clicking into a job then hitting browser back) — the
	// routeLoader$ always reloads the first page fresh. If the URL names a
	// cursor, fetch that exact page directly in one query.
	// biome-ignore lint/correctness/noQwikUseVisibleTask: must re-run on every client-side mount (SPA back/forward), not just first paint
	useVisibleTask$(async () => {
		if (new URL(window.location.href).searchParams.get("cursor")) {
			await loadFromUrl();
		}
	});

	return (
		<div class="max-w-3xl mx-auto px-4 py-8">
			<div class="flex items-center justify-between mb-8">
				<h1 class="text-3xl font-bold text-text-heading">Job Board</h1>
				<Button href="/jobs/new">Post a Job</Button>
			</div>

			<div class="space-y-4">
				{jobs.map((job) => (
					<div
						key={job.id}
						class="bg-white border border-border rounded-lg p-6 hover:border-border-strong transition-colors"
					>
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<Link
									href={`/jobs/${job.id}`}
									class="text-lg font-semibold text-text-heading hover:text-primary"
								>
									{job.title}
								</Link>
								<div class="mt-1 text-sm text-text-muted">
									{locationLabel(job)}
								</div>
							</div>
							{job.link && (
								<a
									href={job.link}
									target="_blank"
									rel="noopener noreferrer"
									class="shrink-0 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary"
								>
									Apply
								</a>
							)}
						</div>
					</div>
				))}
			</div>

			{jobs.length === 0 && (
				<div class="text-center py-16 text-text-muted">
					No job postings at the moment. Check back soon!
				</div>
			)}

			<CursorPager
				hasPrevious={prevCursor.value !== null}
				hasNext={nextCursor.value !== null}
				isLoading={isLoading.value}
				onPrevious$={goPrev}
				onNext$={goNext}
			/>

			<div class="mt-8 pt-8 border-t border-border text-center">
				<Link href="/jobs/mine" class="text-sm text-primary hover:text-primary">
					View my submissions →
				</Link>
			</div>
		</div>
	);
});

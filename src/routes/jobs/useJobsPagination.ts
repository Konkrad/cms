import { $, useSignal } from "@qwik.dev/core";
import type { RequestEventCommon } from "@qwik.dev/router";
import { server$ } from "@qwik.dev/router";
import type { JobsListData } from "~/contracts/jobs";
import { jobsService } from "~/services/jobs.service";

const fetchJobsPage = server$(async function (
	cursor: string | null,
	direction: "forward" | "backward",
) {
	const { requireAuth } = await import("~/utils/server-auth");
	await requireAuth(this as RequestEventCommon);
	return jobsService.getApprovedPaged(10, cursor, direction);
});

/** Headless composable owning cursor pagination for the `/jobs` list view. */
export function useJobsPagination(data: JobsListData) {
	const displayedJobs = useSignal(data.items);
	const nextCursor = useSignal(data.nextCursor);
	const prevCursor = useSignal(data.prevCursor);
	const isLoading = useSignal(false);

	const loadFromUrl = $(async () => {
		const url = new URL(window.location.href);
		const cursor = url.searchParams.get("cursor");
		if (!cursor) {
			displayedJobs.value = data.items;
			nextCursor.value = data.nextCursor;
			prevCursor.value = data.prevCursor;
			return;
		}
		const direction =
			url.searchParams.get("dir") === "prev" ? "backward" : "forward";
		isLoading.value = true;
		try {
			const result = await fetchJobsPage(cursor, direction);
			displayedJobs.value = result.items;
			nextCursor.value = result.nextCursor;
			prevCursor.value = result.prevCursor;
		} catch {
			// Invalid or expired cursor — fall back to the SSR-loaded first page.
			url.searchParams.delete("cursor");
			url.searchParams.delete("dir");
			window.history.replaceState({}, "", url);
			displayedJobs.value = data.items;
			nextCursor.value = data.nextCursor;
			prevCursor.value = data.prevCursor;
		} finally {
			isLoading.value = false;
		}
	});

	const goNext = $(async () => {
		const cursor = nextCursor.value;
		if (!cursor) return;
		isLoading.value = true;
		try {
			const result = await fetchJobsPage(cursor, "forward");
			displayedJobs.value = result.items;
			nextCursor.value = result.nextCursor;
			prevCursor.value = result.prevCursor;
			const url = new URL(window.location.href);
			url.searchParams.set("cursor", cursor);
			url.searchParams.delete("dir");
			window.history.pushState({}, "", url);
		} finally {
			isLoading.value = false;
		}
	});

	const goPrev = $(async () => {
		const cursor = prevCursor.value;
		if (!cursor) return;
		isLoading.value = true;
		try {
			const result = await fetchJobsPage(cursor, "backward");
			displayedJobs.value = result.items;
			nextCursor.value = result.nextCursor;
			prevCursor.value = result.prevCursor;
			const url = new URL(window.location.href);
			if (result.prevCursor === null) {
				// Landed back on the true first page — keep the URL canonical.
				url.searchParams.delete("cursor");
				url.searchParams.delete("dir");
			} else {
				url.searchParams.set("cursor", cursor);
				url.searchParams.set("dir", "prev");
			}
			window.history.pushState({}, "", url);
		} finally {
			isLoading.value = false;
		}
	});

	return {
		displayedJobs,
		nextCursor,
		prevCursor,
		isLoading,
		loadFromUrl,
		goNext,
		goPrev,
	};
}

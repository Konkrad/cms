import { $, useOnWindow, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import type { RequestEventCommon } from "@qwik.dev/router";
import { server$ } from "@qwik.dev/router";
import type { StreamFilter, StreamPage } from "~/contracts/stream";
import { streamFilterTypes } from "~/core/content/content-items";
import { t } from "~/core/i18n";

const fetchStream = server$(async function (options: {
	limit: number;
	show: StreamFilter;
	cursor?: string | null;
	direction?: "forward" | "backward";
}): Promise<StreamPage> {
	const { stream } = await import("~/core/content/stream.service");
	const { getServerSession } = await import("~/core/auth/server-auth");
	const { scopeContentFilter } = await import("~/core/scopes/content-filter");
	const { currentScope } = await import("~/core/router/scope-request");
	const { toStreamCards } = await import("~/core/content/stream-cards");

	const session = await getServerSession(this as RequestEventCommon);
	// The listing of the page's scope (the URL's scope prefix), as this viewer sees it.
	const res = await stream.list(
		await scopeContentFilter(session, await currentScope(this)),
		{
			types: streamFilterTypes(options.show),
			limit: Math.min(Math.max(1, options.limit), 50),
			cursor: options.cursor ?? null,
			direction: options.direction ?? "forward",
		},
	);
	const items = await toStreamCards(res.items, { loggedIn: !!session });

	return { items, nextCursor: res.nextCursor, prevCursor: res.prevCursor };
});

/**
 * Headless composable owning data/pagination for the "Stream" page-builder block: notes and
 * articles of the page's scope, newest first (`show`: both, notes only or articles only).
 * Client-only by design — avoids serializing large bodies and session-dependent user
 * formatting into Qwik SSR state.
 */
export function useStream(pageSize: number, show: StreamFilter = "all") {
	const items = useSignal<StreamPage["items"]>([]);
	const nextCursor = useSignal<string | null>(null);
	const prevCursor = useSignal<string | null>(null);
	const isLoading = useSignal(true);
	const error = useSignal<string | null>(null);

	const loadFromUrl = $(async () => {
		const url = new URL(window.location.href);
		const cursorParam = url.searchParams.get("cursor");
		const direction =
			url.searchParams.get("dir") === "prev" ? "backward" : "forward";
		try {
			const result = await fetchStream({
				show,
				limit: pageSize,
				cursor: cursorParam,
				direction: cursorParam ? direction : "forward",
			});
			items.value = result.items;
			nextCursor.value = result.nextCursor;
			prevCursor.value = result.prevCursor;
		} catch (e) {
			if (cursorParam) {
				// Invalid or expired cursor — fall back to page 1.
				url.searchParams.delete("cursor");
				url.searchParams.delete("dir");
				window.history.replaceState({}, "", url);
				try {
					const result = await fetchStream({
						show,
						limit: pageSize,
					});
					items.value = result.items;
					nextCursor.value = result.nextCursor;
					prevCursor.value = result.prevCursor;
					return;
				} catch (e2) {
					error.value =
						e2 instanceof Error
							? e2.message
							: t("core.content.failedToLoadStream");
					return;
				}
			}
			error.value =
				e instanceof Error ? e.message : t("core.content.failedToLoadStream");
		} finally {
			isLoading.value = false;
		}
	});

	// Deliberately client-only — see the composable's doc comment above.
	// biome-ignore lint/correctness/noQwikUseVisibleTask: avoids serializing large bodies/session-dependent formatting into SSR state
	useVisibleTask$(
		async () => {
			await loadFromUrl();
		},
		{ strategy: "document-ready" },
	);

	const goNext = $(async () => {
		const cursor = nextCursor.value;
		if (!cursor) return;
		isLoading.value = true;
		try {
			const result = await fetchStream({
				show,
				limit: pageSize,
				cursor,
				direction: "forward",
			});
			items.value = result.items;
			nextCursor.value = result.nextCursor;
			prevCursor.value = result.prevCursor;
			const url = new URL(window.location.href);
			url.searchParams.set("cursor", cursor);
			url.searchParams.delete("dir");
			window.history.pushState({}, "", url);
		} catch (e) {
			error.value =
				e instanceof Error ? e.message : t("core.content.failedToLoadStream");
		} finally {
			isLoading.value = false;
		}
	});

	const goPrev = $(async () => {
		const cursor = prevCursor.value;
		if (!cursor) return;
		isLoading.value = true;
		try {
			const result = await fetchStream({
				show,
				limit: pageSize,
				cursor,
				direction: "backward",
			});
			items.value = result.items;
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
		} catch (e) {
			error.value =
				e instanceof Error ? e.message : t("core.content.failedToLoadStream");
		} finally {
			isLoading.value = false;
		}
	});

	// Browser back/forward: re-derive the displayed page from the URL.
	useOnWindow(
		"popstate",
		$(() => {
			void loadFromUrl();
		}),
	);

	return { items, nextCursor, prevCursor, isLoading, error, goNext, goPrev };
}

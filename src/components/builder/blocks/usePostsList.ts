import { $, useOnWindow, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import type { RequestEventCommon } from "@qwik.dev/router";
import { server$ } from "@qwik.dev/router";
import type { PostsPage } from "~/contracts/posts";
import { publicImageUrlFromKey } from "~/utils/images";

const fetchPosts = server$(async function (options: {
	limit: number;
	cursor?: string | null;
	direction?: "forward" | "backward";
}): Promise<PostsPage> {
	const { postsService } = await import("~/services/posts.service");
	const { getServerSession } = await import("~/utils/server-auth");
	const { formatUser } = await import("~/utils/users");

	const session = await getServerSession(this as RequestEventCommon);
	const res = await postsService.getAll(
		options.limit,
		options.cursor ?? null,
		options.direction ?? "forward",
	);

	const items = res.items.map((post) => ({
		...post,
		featuredImage: publicImageUrlFromKey(post.featuredImage),
		user: formatUser(post.user, !!session),
	}));

	return { items, nextCursor: res.nextCursor, prevCursor: res.prevCursor };
});

/**
 * Headless composable owning data/pagination for the "Posts List" page-builder
 * block. Client-only by design — avoids serializing large post bodies and
 * session-dependent user formatting into Qwik SSR state.
 */
export function usePostsList(pageSize: number) {
	const items = useSignal<PostsPage["items"]>([]);
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
			const result = await fetchPosts({
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
					const result = await fetchPosts({ limit: pageSize });
					items.value = result.items;
					nextCursor.value = result.nextCursor;
					prevCursor.value = result.prevCursor;
					return;
				} catch (e2) {
					error.value =
						e2 instanceof Error ? e2.message : "Failed to load posts";
					return;
				}
			}
			error.value = e instanceof Error ? e.message : "Failed to load posts";
		} finally {
			isLoading.value = false;
		}
	});

	// Deliberately client-only — see the composable's doc comment above.
	// biome-ignore lint/correctness/noQwikUseVisibleTask: avoids serializing large post bodies/session-dependent formatting into SSR state
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
			const result = await fetchPosts({
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
			error.value = e instanceof Error ? e.message : "Failed to load posts";
		} finally {
			isLoading.value = false;
		}
	});

	const goPrev = $(async () => {
		const cursor = prevCursor.value;
		if (!cursor) return;
		isLoading.value = true;
		try {
			const result = await fetchPosts({
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
			error.value = e instanceof Error ? e.message : "Failed to load posts";
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

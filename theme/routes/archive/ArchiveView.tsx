import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import type { ArchiveViewData } from "~/contracts/archive";
import { StreamList } from "~theme/shared/StreamList/StreamList";

/** Themed view shared by `/archive/<all|notes|articles>` and their numbered pages. */
export const ArchiveView = component$<{ data: ArchiveViewData }>(({ data }) => {
	if (!data) {
		return (
			<div class="max-w-4xl mx-auto px-4 py-16 text-center">
				<h1 class="text-4xl font-bold text-text-heading mb-4">
					Archive Page Not Found
				</h1>
				<p class="text-text-secondary mb-8">
					The archive page you are looking for does not exist.
				</p>
				<Link
					href="/archive/all"
					class="text-primary hover:text-primary font-medium"
				>
					Go to the archive
				</Link>
			</div>
		);
	}

	const { title, page, items, totalPages, previousHref, nextHref } = data;

	return (
		<div class="max-w-6xl mx-auto px-4 py-12" data-archive={data.show}>
			<div class="mb-8">
				<h1 class="font-semibold text-[36px] md:text-[44px] leading-[1.1] text-text-heading">
					{title}
				</h1>
			</div>

			{items.length === 0 ? (
				<p class="text-text-muted text-center py-8">Nothing here yet.</p>
			) : (
				<StreamList items={items} />
			)}

			{totalPages > 1 && (
				<div class="mt-10 flex items-center justify-between gap-4">
					{previousHref ? (
						<Link
							href={previousHref}
							class="px-4 py-2 border border-border-strong text-sm font-medium text-text-heading hover:bg-bg"
						>
							Previous
						</Link>
					) : (
						<span />
					)}

					<span class="text-sm text-text-secondary">
						Page {page + 1} of {totalPages}
					</span>

					{nextHref ? (
						<Link
							href={nextHref}
							class="px-4 py-2 border border-border-strong text-sm font-medium text-text-heading hover:bg-bg"
						>
							Next
						</Link>
					) : (
						<span />
					)}
				</div>
			)}
		</div>
	);
});

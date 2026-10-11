import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import type { ArchiveViewData } from "~/contracts/archive";
import { loadArchivePage } from "~/core/content/archive-data";
import { ARCHIVE_TITLES, archiveFilter } from "~/core/content/content-items";
import { canonicalUrl } from "~/core/content/seo";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { ArchiveView } from "~theme/routes/archive/ArchiveView";

export const useArchivePage = routeLoader$(
	async (event): Promise<ArchiveViewData> => {
		const page = Number.parseInt(event.params.page ?? "", 10);
		// Page 0 is the archive's start page (`/archive/<type>`).
		if (!(page >= 1)) {
			event.status(404);
			return null;
		}
		return assertNoPrivateFields(await loadArchivePage(event, page));
	},
);

export default component$(() => {
	const archivePage = useArchivePage();
	return <ArchiveView data={archivePage.value} />;
});

// Paginated archive listings beyond page 1 are thin/duplicate content (same
// layout, no unique text) — keep them out of the index and point crawlers
// back at the canonical first page instead.
export const head: DocumentHead = ({ url, params }) => {
	const show = archiveFilter(params.type) ?? "all";
	return {
		title: ARCHIVE_TITLES[show],
		meta: [{ name: "robots", content: "noindex, follow" }],
		links: [
			{ rel: "canonical", href: canonicalUrl(`/archive/${show}`, url.origin) },
		],
	};
};

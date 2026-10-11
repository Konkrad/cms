import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import type { ArchiveViewData } from "~/contracts/archive";
import { loadArchivePage } from "~/core/content/archive-data";
import { ARCHIVE_TITLES, archiveFilter } from "~/core/content/content-items";
import { canonicalUrl } from "~/core/content/seo";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { ArchiveView } from "~theme/routes/archive/ArchiveView";

export const useArchivePage = routeLoader$(
	async (event): Promise<ArchiveViewData> =>
		assertNoPrivateFields(await loadArchivePage(event, 0)),
);

export default component$(() => {
	const archivePage = useArchivePage();
	return <ArchiveView data={archivePage.value} />;
});

export const head: DocumentHead = ({ url, params }) => {
	const show = archiveFilter(params.type) ?? "all";
	return {
		title: ARCHIVE_TITLES[show],
		meta: [{ name: "description", content: "Browse past community news." }],
		links: [
			{ rel: "canonical", href: canonicalUrl(`/archive/${show}`, url.origin) },
		],
	};
};

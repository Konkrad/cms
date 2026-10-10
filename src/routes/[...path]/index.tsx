import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import type { PageViewData } from "~/contracts/page";
import { loadCmsPage } from "~/core/cms-page";
import { matchPage } from "~/core/pages";
import type { BlockData } from "~/db/schemas/shared";
import { currentScopePath, currentScopeRest } from "~/utils/scope-request";
import { canonicalUrl, htmlToDescription } from "~/utils/seo";
import { PageView } from "~theme/routes/page/PageView";
import { moduleViews } from "../../../modules/views";
import { modulePages } from "../../modules";

// Module actions must be exported by the route that renders them. Re-export via a
// RELATIVE path: the production Rollup transform mis-resolves aliased re-exports.
export {
	useDeleteMyJob,
	useSubmitJob,
	useUpdateMyJob,
} from "../../../modules/jobs/actions";

const CMS_PAGE = "cms";

/** Best-effort meta description built from the first block that carries readable text. */
function descriptionFromBlocks(blocks: BlockData[] | null): string {
	for (const block of blocks ?? []) {
		const textValue = Object.values(block.data ?? {}).find(
			(value) => typeof value === "string" && value.trim().length > 0,
		);
		if (typeof textValue === "string") {
			const description = htmlToDescription(textValue);
			if (description) return description;
		}
	}
	return "";
}

/**
 * The single public page route: resolves the module page for the URL remainder
 * after the scope prefix, else falls back to the CMS page at that URL.
 */
export const usePathPage = routeLoader$(async (event) => {
	const rest = currentScopeRest(event);
	const scopePath = currentScopePath(event);
	const match = matchPage(modulePages, rest);
	if (match) {
		const data = await match.page.load(event, {
			params: match.params,
			scopePath,
		});
		return { pageId: match.page.id, key: rest, data: data as unknown };
	}
	// No module page: the CMS page at that URL (CMS pages are not scoped yet).
	const page = await loadCmsPage(event, decodeURIComponent(rest));
	return { pageId: CMS_PAGE, key: rest, data: page as unknown };
});

export default component$(() => {
	const page = usePathPage();
	const { pageId, key, data } = page.value;
	if (pageId === CMS_PAGE) return <PageView page={data as PageViewData} />;
	const View = moduleViews[pageId].view;
	return <View key={key} data={data} />;
});

export const head: DocumentHead = ({ resolveValue, url }) => {
	// During client-side transitions to other routes, this head can run without
	// usePathPage being executed for the current request.
	try {
		const { pageId, data } = resolveValue(usePathPage);
		if (pageId !== CMS_PAGE) return moduleViews[pageId].head?.(data) ?? {};

		const page = data as PageViewData;
		if (!page) {
			return {
				title: "Page Not Found",
			};
		}

		const title = page.menuItem?.title ?? "Community Hub";
		const description = descriptionFromBlocks(page.content);
		const canonical = canonicalUrl(url.pathname, url.origin);

		return {
			title,
			meta: description ? [{ name: "description", content: description }] : [],
			links: [{ rel: "canonical", href: canonical }],
		};
	} catch {
		return {
			title: "Community Hub",
		};
	}
};

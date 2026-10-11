import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import type { PageViewData } from "~/contracts/page";
import type { ScopeViewData } from "~/contracts/scopes";
import { loadCmsPage } from "~/core/content/cms-page";
import { corePages } from "~/core/content/post-page";
import type { BlockData } from "~/core/content/schema/shared";
import { canonicalUrl, htmlToDescription } from "~/core/content/seo";
import { matchPage } from "~/core/router/pages";
import {
	currentScope,
	currentScopePath,
	currentScopeRest,
} from "~/core/router/scope-request";
import { loadScopeHome } from "~/core/scopes/scope-home";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { PageView } from "~theme/routes/page/PageView";
import { ScopeView } from "~theme/routes/scopes/ScopeView";
import { modulePages } from "../../core/registry/manifests";
import { moduleViews } from "../../core/registry/views";
import { useJoinScope } from "../../core/scopes/scope-actions";

// Module actions must be exported by the route that renders them. Re-export via a
// RELATIVE path: the production Rollup transform mis-resolves aliased re-exports.
export * from "../../core/registry/actions";
export { useJoinScope } from "../../core/scopes/scope-actions";

const CMS_PAGE = "cms";
/** Core pages (posts) first, then the active modules' pages, in declared order. */
const publicPages = [...corePages, ...modulePages];
const SCOPE_HOME = "scope";

function scopeHomeHead(data: ScopeViewData, url: URL) {
	const canonical = canonicalUrl(url.pathname, url.origin);
	const description = `${data.scope.name} — ${data.memberCount} members. Join the local community group.`;
	return {
		title: data.scope.name,
		meta: [
			{ name: "description", content: description },
			{ property: "og:type", content: "website" },
			{ property: "og:title", content: data.scope.name },
			{ property: "og:description", content: description },
			{ property: "og:url", content: canonical },
			...(data.image1 ? [{ property: "og:image", content: data.image1 }] : []),
		],
		links: [{ rel: "canonical", href: canonical }],
	};
}

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
	const match = matchPage(publicPages, rest);
	if (match) {
		const data = await match.page.load(event, {
			params: match.params,
			scopePath,
		});
		assertNoPrivateFields(data, { allow: match.page.allowPrivateFields });
		return { pageId: match.page.id, key: rest, data: data as unknown };
	}
	// A scope path alone (`/germany/berlin`) is that scope's home page.
	if (rest === "/" && scopePath !== "/") {
		const scope = await currentScope(event);
		if (scope) {
			const home = assertNoPrivateFields(await loadScopeHome(event, scope));
			return { pageId: SCOPE_HOME, key: scopePath, data: home as unknown };
		}
	}
	// No module page: the scope's CMS page at that slug.
	const page = assertNoPrivateFields(
		await loadCmsPage(
			event,
			await currentScope(event),
			decodeURIComponent(rest),
		),
	);
	return { pageId: CMS_PAGE, key: rest, data: page as unknown };
});

export default component$(() => {
	const page = usePathPage();
	const joinAction = useJoinScope();
	const { pageId, key, data } = page.value;
	if (pageId === CMS_PAGE) return <PageView page={data as PageViewData} />;
	if (pageId === SCOPE_HOME)
		return <ScopeView data={data as ScopeViewData} joinAction={joinAction} />;
	const View = moduleViews[pageId].view;
	return <View key={key} data={data} />;
});

export const head: DocumentHead = ({ resolveValue, url }) => {
	// During client-side transitions to other routes, this head can run without
	// usePathPage being executed for the current request.
	try {
		const { pageId, data } = resolveValue(usePathPage);
		if (pageId === SCOPE_HOME) return scopeHomeHead(data as ScopeViewData, url);
		if (pageId !== CMS_PAGE) return moduleViews[pageId].head?.(data, url) ?? {};

		const page = data as PageViewData;
		if (!page) {
			return {
				title: "Page Not Found",
			};
		}

		const title = page.title || "Community Hub";
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

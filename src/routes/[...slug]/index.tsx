import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import type { BlockData } from "~/db/schemas/shared";
import { pagesService } from "~/services/pages.service";
import { canonicalUrl, htmlToDescription } from "~/utils/seo";
import { PageView } from "~theme/routes/page/PageView";

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

export const usePage = routeLoader$(async ({ params, status }) => {
	// Normalize slug to match database format (with leading slash)
	const slug = params.slug ? `/${params.slug}` : "/";

	const page = await pagesService.getByUrl(slug);

	if (!page) {
		status(404);
		return null;
	}

	if (page.status !== "published") {
		status(404);
		return null;
	}

	return page;
});

export default component$(() => {
	const page = usePage();
	return <PageView page={page.value} />;
});

export const head: DocumentHead = ({ resolveValue, url }) => {
	// During client-side transitions to non-catch-all routes, this head can run
	// without usePage being executed for the current request.
	try {
		const page = resolveValue(usePage);

		if (!page) {
			return {
				title: "Page Not Found",
			};
		}

		const title = page.menuItem?.title ?? "Community Hub";
		const description = descriptionFromBlocks(page.content);
		const canonical = canonicalUrl(url.pathname);

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

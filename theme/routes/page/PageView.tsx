import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { t } from "~/contracts/i18n";
import type { PageViewData } from "~/contracts/page";
import { BlockRenderer } from "~/core/content/builder/BlockRenderer";

/** Themed view for the CMS pages (catch-all route `/[...path]`). */
export const PageView = component$<{ page: PageViewData }>(({ page }) => {
	if (!page) {
		return (
			<div class="max-w-4xl mx-auto px-4 py-16 text-center">
				<h1 class="text-4xl font-bold text-text-heading mb-4">
					{t("theme.page.pageNotFound")}
				</h1>
				<p class="text-text-secondary mb-8">
					{t("theme.page.thePageYouReLooking")}
				</p>
				<Link href="/" class="text-primary hover:text-primary font-medium">
					{t("theme.page.goBackHome")}
				</Link>
			</div>
		);
	}

	return (
		<div class="min-h-screen">
			{page.content && page.content.length > 0 ? (
				<div>
					{page.content
						.slice()
						.sort((a, b) => a.order - b.order)
						.map((block) => (
							<BlockRenderer key={block.id} block={block} />
						))}
				</div>
			) : (
				<div class="max-w-4xl mx-auto px-4 py-16">
					<h1 class="text-4xl font-bold text-text-heading mb-4">
						{page.title}
					</h1>
					<p class="text-text-secondary">
						{t("theme.page.thisPageIsEmptyAdd")}
					</p>
				</div>
			)}
		</div>
	);
});

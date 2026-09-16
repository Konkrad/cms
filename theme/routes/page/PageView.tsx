import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { BlockRenderer } from "~/components/builder/BlockRenderer";
import type { PageViewData } from "~/contracts/page";

/** Themed view for the catch-all CMS page route (`/[...slug]`). */
export const PageView = component$<{ page: PageViewData; s3BaseUrl: string }>(
	({ page, s3BaseUrl }) => {
		if (!page) {
			return (
				<div class="max-w-4xl mx-auto px-4 py-16 text-center">
					<h1 class="text-4xl font-bold text-text-heading mb-4">
						Page Not Found
					</h1>
					<p class="text-text-secondary mb-8">
						The page you're looking for doesn't exist or has been removed.
					</p>
					<Link href="/" class="text-primary hover:text-primary font-medium">
						Go back home
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
								<BlockRenderer
									key={block.id}
									block={block}
									s3BaseUrl={s3BaseUrl}
								/>
							))}
					</div>
				) : (
					<div class="max-w-4xl mx-auto px-4 py-16">
						<h1 class="text-4xl font-bold text-text-heading mb-4">
							{page.menuItem?.title}
						</h1>
						<p class="text-text-secondary">
							This page is empty. Add content in the page builder.
						</p>
					</div>
				)}
			</div>
		);
	},
);

import { component$ } from "@qwik.dev/core";
import { t } from "~/contracts/i18n";
import type { FeedLinks, FooterMenuItems } from "~/contracts/layout";
import { sanitizeSvg } from "~/core/content/svg-sanitize";

/**
 * Themed site footer. Receives footer menu items and the site's feeds (e.g. RSS) as props from
 * `src/routes/layout.tsx` instead of calling its loaders directly.
 */
export const SiteFooter = component$<{
	footerItems: FooterMenuItems;
	feeds?: FeedLinks;
}>(({ footerItems, feeds = [] }) => {
	const items = Array.isArray(footerItems) ? footerItems : [];
	if (items.length === 0 && feeds.length === 0) {
		return null;
	}

	const sortedItems = [...items].sort((a, b) => a.position - b.position);
	const textLinks = sortedItems.filter((item) => !item.icon);
	const iconLinks = sortedItems.filter((item) => !!item.icon);

	return (
		<footer class="border-t border-border bg-white">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
				<div class="flex items-center justify-between gap-4 text-sm text-text-secondary">
					<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
						{textLinks.map((item) => (
							<a
								key={item.id}
								href={item.url}
								target={item.target}
								rel={
									item.target === "_blank" ? "noopener noreferrer" : undefined
								}
								class="hover:text-primary"
							>
								{item.title}
							</a>
						))}
						{feeds.map((feed) => (
							<a
								key={feed.href}
								href={feed.href}
								type={feed.type}
								class="hover:text-primary"
							>
								{t("theme.siteFooter.rss")}
							</a>
						))}
					</div>
					{iconLinks.length > 0 && (
						<div class="flex items-center gap-4">
							{iconLinks.map((item) => (
								<a
									key={item.id}
									href={item.url}
									target={item.target}
									rel={
										item.target === "_blank" ? "noopener noreferrer" : undefined
									}
									title={item.title}
									class="inline-flex items-center justify-center w-5 h-5 shrink-0 text-text-muted hover:text-primary [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
								>
									{(() => {
										const svg = sanitizeSvg(item.icon!);
										return svg ? (
											<span
												class="w-full h-full"
												dangerouslySetInnerHTML={svg}
											/>
										) : (
											<span class="text-[10px] font-semibold">
												{item.title}
											</span>
										);
									})()}
								</a>
							))}
						</div>
					)}
				</div>
			</div>
		</footer>
	);
});

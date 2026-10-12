import { component$ } from "@qwik.dev/core";
import type { ArticleCardData } from "~/contracts/articles";
import { t } from "~/contracts/i18n";
import { cardMeta } from "~theme/shared/StreamList/card-meta";

/** One article in a listing: its image (if any), title and an excerpt, linking to the article. */
export const ArticleCard = component$<{ article: ArticleCardData }>(
	({ article }) => (
		<a
			href={article.url}
			class="group flex flex-col bg-bg-card border border-border overflow-hidden hover:border-border-strong transition-colors"
			data-stream-type="article"
		>
			{article.imageUrl && (
				<div class="aspect-video overflow-hidden shrink-0">
					<img
						src={article.imageUrl}
						alt={article.title}
						width={640}
						height={360}
						class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
					/>
				</div>
			)}
			<div class="flex flex-col flex-1 p-4 gap-1">
				<h3 class="font-semibold text-text-heading group-hover:text-primary transition-colors leading-snug line-clamp-2">
					{article.title}
				</h3>
				<p class="text-xs text-text-muted">
					{article.author.displayName} · {cardMeta(article)}
				</p>
				{article.excerpt && (
					<p class="text-sm text-text-secondary mt-1 line-clamp-3">
						{article.excerpt}
					</p>
				)}
				<span class="text-sm font-medium text-primary mt-auto pt-3">
					{t("theme.articleCard.readMore")}
				</span>
			</div>
		</a>
	),
);

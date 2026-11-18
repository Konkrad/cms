import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import type { ArticleViewData } from "~/contracts/articles";
import { t } from "~/contracts/i18n";
import { Avatar } from "~theme/shared/StreamList/Avatar";
import { formatStreamDate } from "~theme/shared/StreamList/card-meta";
import { StreamList } from "~theme/shared/StreamList/StreamList";

/**
 * Themed presentation for a single article (`<scope path>/articles/:id`): title, date, body,
 * with the featured image and the author beside it.
 *
 * Pure view: receives secret-stripped, URL-resolved data from the route loader via the
 * `ArticleViewData` contract. `article.body` is already sanitized server-side (the articles
 * service) — sanitization stays in core, not here.
 */
export const ArticleView = component$<{ article: ArticleViewData | null }>(
	({ article }) => {
		if (!article) {
			return (
				<div class="max-w-4xl mx-auto px-4 py-16 text-center">
					<h1 class="text-4xl font-bold text-text-heading mb-4">
						{t("theme.article.articleNotFound")}
					</h1>
					<p class="text-text-secondary mb-8">
						{t("theme.article.theArticleYouReLooking")}
					</p>
					<Link href="/" class="text-primary hover:text-primary font-medium">
						{t("theme.article.goBackHome")}
					</Link>
				</div>
			);
		}

		const a = article;
		return (
			<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
				<article
					class="lg:grid lg:grid-cols-[1fr_320px] lg:gap-12"
					data-layout="article"
				>
					<div class="min-w-0">
						<h1 class="text-3xl sm:text-4xl font-bold text-text-heading leading-tight mb-3">
							{a.title}
						</h1>
						<time
							dateTime={a.publishedAt}
							class="block text-sm text-text-muted mb-8"
						>
							{formatStreamDate(a.publishedAt)}
						</time>

						{/* Mobile: the featured image sits between date and body */}
						{a.imageUrl && (
							<div class="lg:hidden mb-8">
								<div
									class="overflow-hidden mx-auto"
									style={{ aspectRatio: "1/1", width: "min(100%, 280px)" }}
								>
									<img
										src={a.imageUrl}
										alt={a.title}
										width={280}
										height={280}
										class="w-full h-full object-cover"
									/>
								</div>
							</div>
						)}

						{a.subject && (
							<p class="text-sm text-text-secondary mb-6">
								{t("theme.article.about")}{" "}
								<Link href={a.subject.url} class="text-primary hover:underline">
									{a.subject.title}
								</Link>
							</p>
						)}
						<div
							class="prose prose-lg max-w-none text-text"
							dangerouslySetInnerHTML={a.body}
						/>
					</div>

					{/* Image (desktop) and author beside the text */}
					<aside class="mt-10 lg:mt-1 flex flex-col gap-6">
						{a.imageUrl && (
							<div class="hidden lg:block overflow-hidden border border-border">
								<img
									src={a.imageUrl}
									alt={a.title}
									width={400}
									height={400}
									class="w-full object-cover"
									style={{ aspectRatio: "1/1" }}
									data-testid="article-image"
								/>
							</div>
						)}
						<AuthorCard
							displayName={a.author.displayName}
							avatarUrl={a.author.avatarUrl}
							profileUrl={a.author.profileUrl}
						/>
					</aside>
				</article>

				{a.related.length > 0 && (
					<section class="mt-20 pt-12 border-t border-border">
						<h2 class="text-2xl font-bold text-text-heading mb-8 text-center">
							{t("theme.article.moreNews")}
						</h2>
						<StreamList items={a.related} />
					</section>
				)}
			</div>
		);
	},
);

const AuthorCard = component$<{
	displayName: string;
	avatarUrl: string | null;
	profileUrl: string;
}>((props) => (
	<div class="bg-primary-dark p-5 text-white">
		<h3 class="text-lg font-bold mb-3">{t("theme.article.author")}</h3>
		<div class="flex items-center gap-3 mb-4">
			<Avatar displayName={props.displayName} avatarUrl={props.avatarUrl} />
			<span class="font-medium">{props.displayName}</span>
		</div>
		<Link
			href={props.profileUrl}
			class="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white transition-colors"
		>
			{t("theme.article.visitProfile")}
		</Link>
	</div>
));

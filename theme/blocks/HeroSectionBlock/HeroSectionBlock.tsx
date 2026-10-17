import { $, component$, useSignal } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";
import { useHeroSection } from "~/core/content/builder/blocks/useHeroSection";
import "./HeroSectionBlock.css";

export const definition: BlockDefinition = {
	name: t("theme.blocks.heroSection.heroSection"),
	componentType: "HeroSectionBlock",
	category: "dynamic",
	icon: "🖼️",
	configSchema: [],
	defaultData: {},
};

const SLIDE_GRADIENTS = [
	"linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)",
	"linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)",
	"linear-gradient(135deg, var(--color-accent-dark) 0%, var(--color-accent) 100%)",
];

export default component$(() => {
	const { articles, isLoading } = useHeroSection();
	const currentSlide = useSignal(0);

	const goToSlide = $((index: number) => {
		currentSlide.value = index;
	});

	if (isLoading.value) {
		return (
			<div class="hero-section-loading">
				<div class="hero-section-loading-text">
					{t("theme.heroSectionBlock.loadingLatestArticles")}
				</div>
			</div>
		);
	}

	if (articles.value.length === 0) {
		return (
			<div class="hero-section-empty">
				<div class="hero-section-empty-text">
					{t("theme.heroSectionBlock.noArticlesYet")}
				</div>
			</div>
		);
	}

	const slide = articles.value[currentSlide.value];
	const slideGradient =
		SLIDE_GRADIENTS[currentSlide.value % SLIDE_GRADIENTS.length];
	const excerpt = slide.excerpt;

	return (
		<div class="hero-section-container">
			{/* ── Mobile: horizontal scroll-snap carousel ── */}
			<div class="hero-carousel-outer">
				{articles.value.map((article, index) => {
					const gradient = SLIDE_GRADIENTS[index % SLIDE_GRADIENTS.length];
					return (
						<div key={article.id} class="hero-carousel-slide">
							<a href={article.url} class="hero-carousel-card">
								<div class="hero-carousel-image-wrap">
									{article.imageUrl ? (
										<img
											src={article.imageUrl}
											alt={article.title}
											class="hero-carousel-image"
											width={400}
											height={400}
										/>
									) : (
										<div
											class="hero-carousel-gradient"
											style={{ background: gradient }}
										>
											<span class="hero-carousel-slide-number">
												{index + 1}
											</span>
										</div>
									)}
								</div>
								<div class="hero-carousel-content">
									<h2 class="hero-carousel-title">{article.title}</h2>
									<span class="hero-carousel-cta">
										{t("theme.heroSectionBlock.readMore")}
									</span>
								</div>
							</a>
						</div>
					);
				})}
			</div>

			{/* ── Desktop Layout ── */}
			<div class="hero-section-desktop">
				<div class="hero-section-desktop-image-wrapper">
					<div class="hero-section-desktop-image-frame">
						{slide.imageUrl ? (
							<img
								src={slide.imageUrl}
								alt={slide.title}
								class="hero-section-desktop-image"
								width={400}
								height={400}
							/>
						) : (
							<div
								class="hero-section-desktop-gradient"
								style={{ background: slideGradient }}
							>
								<span class="hero-section-desktop-slide-number">
									{currentSlide.value + 1}
								</span>
							</div>
						)}
					</div>
				</div>

				<div class="hero-section-desktop-content">
					<h1 class="hero-section-desktop-title">{slide.title}</h1>

					{excerpt && <p class="hero-section-desktop-description">{excerpt}</p>}

					<Button href={slide.url} size="xl">
						{t("theme.heroSectionBlock.readTheArticle")}
					</Button>
				</div>
			</div>

			{/* ── Pagination Dots (desktop only) ── */}
			{articles.value.length > 1 && (
				<div class="hero-section-pagination">
					{articles.value.map((_, index) => (
						<button
							key={index}
							type="button"
							class={`hero-section-dot ${currentSlide.value === index ? "hero-section-dot-active" : ""}`}
							onClick$={$(() => goToSlide(index))}
							aria-label={t("theme.heroSectionBlock.goToSlide", {
								value: index + 1,
							})}
						/>
					))}
				</div>
			)}
		</div>
	);
});

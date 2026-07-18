import { $, component$, useSignal } from "@qwik.dev/core";
import { useHeroSection } from "~/components/builder/blocks/useHeroSection";
import { Button } from "~/components/ui/Button";
import type { BlockDefinition } from "~/contracts/blocks";
import "./HeroSectionBlock.css";

export const definition: BlockDefinition = {
	name: "Hero Section",
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

function stripHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function getExcerpt(body: string, maxLength: number = 120): string {
	const plain = stripHtml(body);
	if (plain.length <= maxLength) return plain;
	return `${plain.substring(0, maxLength).trimEnd()}...`;
}

export default component$(() => {
	const { posts, isLoading } = useHeroSection();
	const currentSlide = useSignal(0);

	const goToSlide = $((index: number) => {
		currentSlide.value = index;
	});

	if (isLoading.value) {
		return (
			<div class="hero-section-loading">
				<div class="hero-section-loading-text">Loading latest articles...</div>
			</div>
		);
	}

	if (posts.value.length === 0) {
		return (
			<div class="hero-section-empty">
				<div class="hero-section-empty-text">No articles yet.</div>
			</div>
		);
	}

	const slide = posts.value[currentSlide.value];
	const slideGradient =
		SLIDE_GRADIENTS[currentSlide.value % SLIDE_GRADIENTS.length];
	const excerpt = slide.body ? getExcerpt(slide.body) : "";

	return (
		<div class="hero-section-container">
			{/* ── Mobile: horizontal scroll-snap carousel ── */}
			<div class="hero-carousel-outer">
				{posts.value.map((post, index) => {
					const gradient = SLIDE_GRADIENTS[index % SLIDE_GRADIENTS.length];
					return (
						<div key={post.id} class="hero-carousel-slide">
							<a href={`/posts/${post.id}`} class="hero-carousel-card">
								<div class="hero-carousel-image-wrap">
									{post.featuredImageUrl ? (
										<img
											src={post.featuredImageUrl}
											alt={post.title}
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
									<h2 class="hero-carousel-title">{post.title}</h2>
									<span class="hero-carousel-cta">Read more →</span>
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
						{slide.featuredImageUrl ? (
							<img
								src={slide.featuredImageUrl}
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

					<Button href={`/posts/${slide.id}`} size="xl">
						Read the Article
					</Button>
				</div>
			</div>

			{/* ── Pagination Dots (desktop only) ── */}
			{posts.value.length > 1 && (
				<div class="hero-section-pagination">
					{posts.value.map((_, index) => (
						<button
							key={index}
							type="button"
							class={`hero-section-dot ${currentSlide.value === index ? "hero-section-dot-active" : ""}`}
							onClick$={$(() => goToSlide(index))}
							aria-label={`Go to slide ${index + 1}`}
						/>
					))}
				</div>
			)}
		</div>
	);
});

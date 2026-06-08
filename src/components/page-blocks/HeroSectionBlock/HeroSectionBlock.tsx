import { component$, useSignal, useTask$, $ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { BlockDefinition } from "~/db/schema";
import type { PostWithUser } from "~/services/posts.service";
import { postsService } from "~/services/posts.service";
import { publicImageUrlFromKey } from "~/utils/images";
import { Button } from "~/components/ui/Button";
import "./HeroSectionBlock.css";

export const definition: BlockDefinition = {
  name: "Hero Section",
  componentType: "HeroSectionBlock",
  category: "dynamic",
  icon: "🖼️",
  configSchema: [],
  defaultData: {},
};

interface HeroPost extends PostWithUser {
  featuredImageUrl: string | null;
}

const fetchLatestGlobalPosts = server$(async () => {
  const res = await postsService.getVisiblePosts(null, 3);
  const postsWithUrls: HeroPost[] = res.items.map((post) => ({
    ...post,
    featuredImageUrl: publicImageUrlFromKey(post.featuredImage),
  }));
  return postsWithUrls;
});

const SLIDE_GRADIENTS = [
  "linear-gradient(135deg, #034EA2 0%, #0a6dd6 50%, #3b8de0 100%)",
  "linear-gradient(135deg, #031241 0%, #08307a 50%, #134fb3 100%)",
  "linear-gradient(135deg, #1a5c2e 0%, #3a8a4f 50%, #96C247 100%)",
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
  return plain.substring(0, maxLength).trimEnd() + "...";
}

export default component$(() => {
  const posts = useSignal<HeroPost[]>([]);
  const isLoading = useSignal(true);
  const currentSlide = useSignal(0);

  useTask$(async () => {
    try {
      posts.value = await fetchLatestGlobalPosts();
    } catch (e) {
      console.error("HeroSectionBlock: Failed to fetch posts", e);
    } finally {
      isLoading.value = false;
    }
  });

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
                    />
                  ) : (
                    <div
                      class="hero-carousel-gradient"
                      style={{ background: gradient }}
                    >
                      <span class="hero-carousel-slide-number">{index + 1}</span>
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
          <div class="hero-section-desktop-image-bg" />
        </div>

        <div class="hero-section-desktop-content">
          <h1 class="hero-section-desktop-title">{slide.title}</h1>

          {excerpt && (
            <p class="hero-section-desktop-description">{excerpt}</p>
          )}

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

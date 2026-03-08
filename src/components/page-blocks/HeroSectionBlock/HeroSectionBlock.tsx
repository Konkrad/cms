import { $, component$, useSignal, useTask$ } from "@builder.io/qwik";
import { Link, server$ } from "@builder.io/qwik-city";
import type { BlockDefinition } from "~/db/schema";
import type { PostWithUser } from "~/services/posts.service";
import "./HeroSectionBlock.css";

export const definition: BlockDefinition = {
  name: "Hero Section",
  componentType: "HeroSectionBlock",
  category: "dynamic",
  icon: "🖼️",
  configSchema: [],
  defaultData: {},
};

const fetchLatestGlobalPosts = server$(async () => {
  const { postsService } = await import("~/services/posts.service");
  const res = await postsService.getVisiblePosts(null, 3);
  return res.items;
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
  const posts = useSignal<PostWithUser[]>([]);
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
      {/* ── Mobile Layout ── */}
      <div class="hero-section-mobile">
        <div class="hero-section-mobile-image-wrapper">
          <div
            class="hero-section-mobile-gradient"
            style={{ background: slideGradient }}
          >
            <span class="hero-section-mobile-slide-number">
              {currentSlide.value + 1}
            </span>
          </div>
        </div>

        <div class="hero-section-mobile-card">
          <h2 class="hero-section-mobile-title">{slide.title}</h2>

          <Link
            href={`/posts/${slide.id}`}
            class="hero-section-mobile-cta"
          >
            <div class="hero-section-arrow-circle">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>

            <span class="hero-section-mobile-cta-text">Read more</span>

            <svg
              width="19"
              height="18"
              viewBox="0 0 19 18"
              fill="none"
              class="hero-section-mobile-small-arrow"
            >
              <path
                d="M4 9h11M11 4.5L15 9l-4 4.5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── Desktop Layout ── */}
      <div class="hero-section-desktop">
        <div class="hero-section-desktop-image-wrapper">
          <div class="hero-section-desktop-image-frame">
            <div
              class="hero-section-desktop-gradient"
              style={{ background: slideGradient }}
            >
              <span class="hero-section-desktop-slide-number">
                {currentSlide.value + 1}
              </span>
            </div>
          </div>
          <div class="hero-section-desktop-image-bg" />
        </div>

        <div class="hero-section-desktop-content">
          <h1 class="hero-section-desktop-title">{slide.title}</h1>

          {excerpt && (
            <p class="hero-section-desktop-description">{excerpt}</p>
          )}

          <Link
            href={`/posts/${slide.id}`}
            class="hero-section-desktop-button"
          >
            Read the Article
          </Link>
        </div>
      </div>

      {/* ── Pagination Dots ── */}
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

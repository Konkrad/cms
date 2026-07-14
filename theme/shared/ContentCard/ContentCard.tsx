import { component$ } from "@qwik.dev/core";

export interface ContentCardProps {
  image?: string | null;
  imageAlt?: string;
  category?: string;
  title: string;
  date?: string;
  meta?: string;
  description?: string;
  href: string;
  label?: string;
}

export const ContentCard = component$<ContentCardProps>(
  ({ image, imageAlt, category, title, date, meta, description, href, label }) => {
    return (
      <a
        href={href}
        class="group flex flex-col bg-bg-card border border-border overflow-hidden hover:border-border-strong transition-colors"
      >
        {image && (
          <div class="aspect-video overflow-hidden shrink-0">
            <img
              src={image}
              alt={imageAlt || title}
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <div class="flex flex-col flex-1 p-4 gap-1">
          {category && (
            <span class="text-xs font-semibold text-primary uppercase tracking-wide">
              {category}
            </span>
          )}
          <h3 class="font-semibold text-text-heading group-hover:text-primary transition-colors leading-snug line-clamp-2">
            {title}
          </h3>
          {(date || meta) && (
            <p class="text-xs text-text-muted">
              {[date, meta].filter(Boolean).join(" · ")}
            </p>
          )}
          {description && (
            <p class="text-sm text-text-secondary mt-1 line-clamp-2">
              {description}
            </p>
          )}
          <span class="text-sm font-medium text-primary mt-auto pt-3">
            {label ?? "Read more →"}
          </span>
        </div>
      </a>
    );
  },
);

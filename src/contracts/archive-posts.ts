/**
 * Core → theme data contract for the post archive routes
 * (`/archive/posts`, `/archive/posts/[page]`).
 */
import type { PostWithUser } from "~/services/posts.service";

export type ArchivePostItem = Omit<PostWithUser, "featuredImage"> & {
  featuredImage: string | null;
};

export type ArchivePostsViewData = {
  page: number;
  items: ArchivePostItem[];
  totalPages: number;
  previousHref: string | null;
  nextHref: string | null;
} | null;

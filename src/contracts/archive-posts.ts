/**
 * Core → theme data contract for the post archive routes
 * (`/archive/posts`, `/archive/posts/[page]`): notes and articles mixed.
 */
import type { PostCardData } from "~/contracts/posts";

export type ArchivePostsViewData = {
	page: number;
	items: PostCardData[];
	totalPages: number;
	previousHref: string | null;
	nextHref: string | null;
} | null;

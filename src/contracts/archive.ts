/**
 * Core → theme data contract for the archive routes (`/archive/<all|notes|articles>` and
 * `/archive/<type>/<page>`): notes and articles mixed, or one type.
 */
import type { StreamFilter, StreamItemData } from "~/contracts/stream";

export type ArchiveViewData = {
	/** Which types this archive shows. */
	show: StreamFilter;
	/** "News Archive", "Notes Archive", "Article Archive". */
	title: string;
	/** The archive's first page (also the "not found" link). */
	startHref: string;
	page: number;
	items: StreamItemData[];
	totalPages: number;
	previousHref: string | null;
	nextHref: string | null;
} | null;

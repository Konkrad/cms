import type { StreamItemData } from "~/contracts/stream";

const VISIBILITY_NOTE: Record<string, string | undefined> = {
	members: "Members only",
	representatives: "Representatives only",
};

export function formatStreamDate(date: string): string {
	return new Date(date).toLocaleDateString("en-GB", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

/** "11 October 2026 · Berlin · Members only": date, source scope and visibility of a card. */
export function cardMeta(item: StreamItemData): string {
	return [
		formatStreamDate(item.publishedAt),
		item.source,
		VISIBILITY_NOTE[item.visibility],
	]
		.filter(Boolean)
		.join(" · ");
}

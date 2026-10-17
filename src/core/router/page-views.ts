import type { Component } from "@qwik.dev/core";
import type { DocumentHeadValue } from "@qwik.dev/router";

/** Client-safe half of a module page: how to render and title its loaded data. */
export interface PageViewEntry {
	// biome-ignore lint/suspicious/noExplicitAny: each view narrows its own data type
	view: Component<{ data: any }>;
	head?: (data: unknown, url: URL) => DocumentHeadValue;
}

export type PageViews = Record<string, PageViewEntry>;

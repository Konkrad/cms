import type { Page } from "@playwright/test";

/** Pause so the recorded clip is watchable at normal speed instead of a rushed blitz through the UI. */
export async function beat(page: Page, ms = 1200) {
	await page.waitForTimeout(ms);
}

import type { Locator, Page } from "@playwright/test";

// Playwright drives the mouse without rendering a visible pointer, so a raw
// recording looks like the UI is filling itself in by magic. This overlay
// renders a cursor glyph that tracks real `mousemove` events (dispatched by
// page.mouse.move), and the glide* helpers below move the mouse there in
// discrete steps before every click/fill so the cursor visibly travels
// instead of teleporting.
export async function injectCursor(page: Page) {
	await page.addInitScript(() => {
		// addInitScript runs in every frame, including cross-origin iframes
		// (e.g. Stripe's Payment Element) — without this guard, each iframe
		// mounts its own independent cursor overlay + mousemove listener, so
		// two cursors become simultaneously visible whenever the real mouse
		// crosses into the iframe (e.g. near the card's country/postal fields).
		// Only the top-level document should render the cursor.
		if (window.top !== window.self) return;

		const CURSOR_ID = "__promo_cursor__";
		function mount() {
			if (document.getElementById(CURSOR_ID)) return;
			const el = document.createElement("div");
			el.id = CURSOR_ID;
			el.style.cssText = [
				"position: fixed",
				"top: 0",
				"left: 0",
				"width: 24px",
				"height: 24px",
				"pointer-events: none",
				"z-index: 2147483647",
				"transform: translate(-2px, -2px)",
				"transition: transform 80ms linear",
				"will-change: transform",
			].join(";");
			el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
				<path d="M3 2 L3 20 L8.5 15.8 L11.8 22 L14.9 20.4 L11.6 14.2 L19 14.2 Z" fill="black" stroke="white" stroke-width="1.6" stroke-linejoin="round"/>
			</svg>`;
			document.documentElement.appendChild(el);
			window.addEventListener("mousemove", (e) => {
				el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
			});
		}
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", mount);
		} else {
			mount();
		}
	});
}

/** Glides the real mouse to the center of `locator` in visible steps. */
export async function glideTo(page: Page, locator: Locator, steps = 25) {
	const box = await locator.boundingBox();
	if (!box) {
		throw new Error("glideTo: target has no bounding box (not visible?)");
	}
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
		steps,
	});
}

/** Glides the cursor to `locator`, then clicks it. */
export async function glideClick(
	page: Page,
	locator: Locator,
	opts?: Parameters<Locator["click"]>[0],
) {
	await glideTo(page, locator);
	await locator.click(opts);
}

/** Glides the cursor to `locator`, clicks to focus it, then fills it. */
export async function glideFill(
	page: Page,
	locator: Locator,
	value: string,
	opts?: Parameters<Locator["fill"]>[1],
) {
	await glideTo(page, locator);
	await locator.click();
	await locator.fill(value, opts);
}

/** Glides the cursor to `locator` and checks it (checkbox/radio). */
export async function glideCheck(page: Page, locator: Locator) {
	await glideTo(page, locator);
	await locator.check();
}

/**
 * Smoothly scrolls `locator` into view (native smooth-scroll animation,
 * unlike Locator.scrollIntoViewIfNeeded()'s instant jump) so page scrolling
 * reads as deliberate camera movement in the recording rather than a cut.
 */
export async function smoothScrollIntoView(page: Page, locator: Locator) {
	await locator.evaluate((el) =>
		el.scrollIntoView({ behavior: "smooth", block: "start" }),
	);
	// Let the smooth-scroll animation actually finish before the next action.
	await page.waitForTimeout(900);
}

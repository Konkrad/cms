import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import {
	createDbSession,
	getUserIdByEmail,
	openDb,
	test,
} from "../../tests/fixtures";
import { glideClick, glideFill, injectCursor } from "./cursor";
import { beat } from "./pace";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The Input UI primitive (src/components/ui/Input/Input.tsx) renders a plain
// <label> immediately followed by its <input> — not wrapped — so getByLabel()
// can't resolve it via accessible name. Match on DOM adjacency instead.
function fieldByLabel(page: Page, label: string) {
	return page.locator(`label:has-text("${label}") + input`);
}

// Real free-to-use event photos (Unsplash License) so the recording shows a
// realistic reunion-dinner scene instead of a solid-color placeholder.
const EVENT_PHOTOS = [
	"fixtures/event-photo-1.jpg", // rooftop group toasting drinks
	"fixtures/event-photo-2.jpg", // friends group selfie outdoors
].map((p) => fs.readFileSync(path.join(__dirname, p)));

// Records: an admin creates an event, types a real venue into the location
// autocomplete and picks a live suggestion (Nominatim/OpenStreetMap — a real
// network call, not stubbed, so lat/lon actually resolves), and adds a paid
// ticket product. events-member-flow.spec.ts picks up this exact event
// afterwards — run this spec first (default alphabetical order does this).
// Not a CI test — run standalone via `npm run promo-videos` (see
// playwright.promo.config.ts). Requires the promo DB to be seeded first via
// `npm run db:seed:promo -- --fresh` (the webServer command does this).
// Re-run after UI changes to the event-creation/products screens to refresh
// the clip.
test("admin creates and prices the reunion dinner", async ({
	browser,
}, testInfo) => {
	const priyaId = getUserIdByEmail("priya.kapoor@example.com");
	if (!priyaId) {
		throw new Error(
			"Priya Kapoor not found — run `npm run db:seed:promo -- --fresh` before recording.",
		);
	}
	const { sessionToken } = createDbSession(priyaId);

	// A manually-created context doesn't inherit the project's `use.video`
	// config the way the built-in `page` fixture does — record explicitly.
	const ctx = await browser.newContext({
		// A manually-created context also doesn't inherit the project's
		// `use.viewport` — leaving it unset defaults to 1280x720, which then
		// mismatches recordVideo.size below and makes Playwright scale/letterbox
		// the capture with grey padding bars.
		viewport: { width: 1100, height: 750 },
		recordVideo: {
			dir: testInfo.outputDir,
			size: { width: 1100, height: 750 },
		},
	});
	await ctx.addCookies([
		{
			name: "session",
			value: sessionToken,
			domain: "localhost",
			path: "/",
			httpOnly: true,
			secure: false,
			sameSite: "Strict",
		},
	]);
	const page = await ctx.newPage();
	await injectCursor(page);

	try {
		await page.goto("/admin/global/events/new");
		await beat(page);

		await glideFill(
			page,
			page.getByPlaceholder("e.g. Monthly Community Meetup"),
			"Class of 2016 Reunion Dinner",
		);
		await beat(page, 600);
		await glideFill(
			page,
			page.getByPlaceholder("Describe the event..."),
			"An evening of reconnecting with old classmates over dinner at Vienna's historic Palm House — catering and a photographer on site.",
		);
		await beat(page, 600);

		// The date field is a flatpickr calendar widget, not a plain text input, and
		// its own month-dropdown/day-grid/time-spinner combo is flaky to drive by
		// hand (animated re-renders, hidden native <select>). Drive flatpickr's own
		// API instead — deterministic, and still renders the real formatted value
		// in the visible field for the recording.
		const startInput = page.getByPlaceholder("Select start date");
		await glideClick(page, startInput);
		await beat(page, 400);
		await page.evaluate(() => {
			const input = document.querySelector<HTMLInputElement>(
				'input[placeholder="Select start date"]',
			);
			// biome-ignore lint/suspicious/noExplicitAny: flatpickr attaches its instance as an untyped property
			const fp = (input as any)?._flatpickr;
			fp?.setDate(new Date(2026, 8, 20, 18, 0), true);
		});
		await beat(page, 600);
		// SmartDatePicker only auto-fills endDate when "Multi-day event" is toggled
		// on (its sync-end-date logic is gated on the end picker's DOM ref, which
		// doesn't exist otherwise) — for a single-day event, set it directly.
		await page.evaluate(() => {
			const end = document.querySelector<HTMLInputElement>(
				'input[name="endDate"]',
			);
			if (end) end.value = new Date(2026, 8, 20, 21, 30).toISOString();
		});
		await page.keyboard.press("Escape");
		await beat(page, 600);

		// Type a real venue and let the live Nominatim autocomplete respond —
		// this is the feature the recording exists to prove works, so no stub.
		const addressInput = page.getByPlaceholder("Start typing an address...");
		await glideFill(page, addressInput, "Palmenhaus Schönbrunn");
		await page.waitForSelector("text=Palm House", { timeout: 10_000 });
		await beat(page, 500);
		await glideClick(page, page.locator("text=Palm House").first());
		await beat(page, 800);

		// Uppy only mounts once its container scrolls into view (Qwik useVisibleTask$),
		// so the file inputs don't exist in the DOM until we scroll to them.
		await page.getByText("Event Page Images").scrollIntoViewIfNeeded();
		await beat(page, 800);

		// Two independent Uppy Dashboards (Image Left / Image Right) — each renders
		// its own <input type="file">, so scope to the dashboard, not the page.
		const dashboards = page.locator(".uppy-Dashboard");
		for (let i = 0; i < 2; i++) {
			await dashboards
				.nth(i)
				.locator('input[type="file"]')
				.first()
				.setInputFiles({
					name: `event-photo-${i + 1}.jpg`,
					mimeType: "image/jpeg",
					buffer: EVENT_PHOTOS[i],
				});
			await beat(page, 800);
			await glideClick(
				page,
				dashboards.nth(i).locator('button:has-text("Confirm Crop")'),
			);
			await beat(page, 600);
		}

		await beat(page);
		await glideClick(page, page.locator('button:has-text("Create Event")'));
		// Creation redirects to the events list (not a per-event detail URL), so
		// there's no id to scrape from the URL — look the new event up by title.
		await page.waitForURL(/\/admin\/global\/events\/?$/, { timeout: 15_000 });
		await page.waitForLoadState("networkidle");
		await beat(page, 1500);

		const db = openDb();
		const created = db
			.prepare("SELECT id FROM events WHERE title = ? LIMIT 1")
			.get("Class of 2016 Reunion Dinner") as { id: string };
		db.close();

		// Add a paid inventory group + product so the event has a ticket price.
		// Occasionally races Qwik's own client-side navigation and aborts — retry once.
		try {
			await page.goto(`/admin/global/events/${created.id}/products`);
		} catch {
			await page.goto(`/admin/global/events/${created.id}/products`);
		}
		await beat(page);

		await glideClick(
			page,
			page.locator('button:has-text("New Inventory Group")'),
		);
		await beat(page, 600);
		await glideFill(
			page,
			fieldByLabel(page, "Group Name"),
			"General Admission",
		);
		await glideFill(page, fieldByLabel(page, "Max Capacity"), "80");
		await beat(page, 600);
		await glideClick(page, page.locator('button:has-text("Create Group")'));
		await beat(page, 1200);

		await glideClick(page, page.locator('button:has-text("Add Product")'));
		await beat(page, 600);
		await glideFill(
			page,
			fieldByLabel(page, "Product Name"),
			"Reunion Dinner Ticket",
		);
		await beat(page, 400);
		await glideFill(page, fieldByLabel(page, "Price (EUR)"), "65");
		await beat(page, 400);
		await glideFill(page, fieldByLabel(page, "Max Quantity per Purchase"), "4");
		await beat(page, 800);
		await glideClick(page, page.locator('button[type="submit"]'));
		await beat(page, 1500);
	} finally {
		await ctx.close();
	}
});

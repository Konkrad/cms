import crypto from "node:crypto";
import Stripe from "stripe";
import {
	createDbSession,
	getUserIdByEmail,
	openDb,
	test,
} from "../../tests/fixtures";
import {
	glideCheck,
	glideClick,
	glideFill,
	injectCursor,
	smoothScrollIntoView,
} from "./cursor";
import { beat } from "./pace";

const EVENT_TITLE = "Class of 2016 Reunion Dinner";
const PRODUCT_NAME = "Reunion Dinner Ticket";
const PRODUCT_PRICE = 65;

// Elena, Marcus, Sofia, Tariq, and Noah — already-onboarded members "already
// going" to the reunion before Maya even opens the page. Seeded here (not in
// scripts/seed-promo.ts) because the participation_status rows need a real
// event_id, and the event only exists once events-admin-flow.spec.ts has
// created it — this is the actual dependency between the two recordings, not
// just a shared premise. The public "who's going" tile only shows the avatar
// stack once count >= 5, hence 5 names.
const BACKGROUND_ATTENDEE_EMAILS = [
	"elena.ruiz@example.com",
	"marcus.webb@example.com",
	"sofia.novak@example.com",
	"tariq.hassan@example.com",
	"noah.bergman@example.com",
];

// Records: a member opens the reunion dinner (created live by
// events-admin-flow.spec.ts — run that one first), sees who's already going,
// buys 2 tickets, searches for and adds a friend as her second participant,
// completes her food preference and photo consent live (first time through
// checkout), and pays via the real Stripe checkout flow (stripe-mock in test
// mode — see tests/e2e/tickets.spec.ts for the same pattern this is adapted
// from).
// Not a CI test — run standalone via `npm run promo-videos` (see
// playwright.promo.config.ts). Re-run after UI changes to the checkout flow
// to refresh the clip.
test("member buys tickets and brings a friend to the reunion", async ({
	browser,
}, testInfo) => {
	const db = openDb();

	const event = db
		.prepare("SELECT id FROM events WHERE title = ? LIMIT 1")
		.get(EVENT_TITLE) as { id: string } | undefined;
	if (!event) {
		db.close();
		throw new Error(
			`Event "${EVENT_TITLE}" not found — run events-admin-flow.spec.ts first (it creates this event live).`,
		);
	}

	const product = db
		.prepare("SELECT id FROM products WHERE event_id = ? AND name = ? LIMIT 1")
		.get(event.id, PRODUCT_NAME) as { id: string } | undefined;
	if (!product) {
		db.close();
		throw new Error(
			`Product "${PRODUCT_NAME}" not found on "${EVENT_TITLE}" — run events-admin-flow.spec.ts first (it creates this product live).`,
		);
	}

	// Seed "who's going" now that the event exists. Skips anyone already marked
	// (safe to re-run this spec without re-running the admin one).
	const now = new Date().toISOString();
	for (const email of BACKGROUND_ATTENDEE_EMAILS) {
		const login = db
			.prepare("SELECT id FROM logins WHERE email = ?")
			.get(email) as { id: string } | undefined;
		if (!login) continue;
		const user = db
			.prepare("SELECT id FROM users WHERE login_id = ? LIMIT 1")
			.get(login.id) as { id: string } | undefined;
		if (!user) continue;

		const existing = db
			.prepare(
				"SELECT id FROM participation_status WHERE user_id = ? AND event_id = ?",
			)
			.get(user.id, event.id);
		if (existing) continue;

		db.prepare(
			"INSERT INTO participation_status (id, user_id, event_id, status, updated_at) VALUES (?, ?, ?, 'yes', ?)",
		).run(crypto.randomUUID(), user.id, event.id, now);
	}
	db.close();

	const mayaId = getUserIdByEmail("maya.chen@example.com");
	if (!mayaId) {
		throw new Error(
			"Maya Chen not found — run `npm run db:seed:promo -- --fresh` before recording.",
		);
	}
	const { sessionToken } = createDbSession(mayaId);

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
		await page.goto(`/events/${event.id}`);
		await beat(page, 1200);

		// "Who's going" only shows the avatar stack once 5+ people are marked —
		// wait for it to actually render before moving on, proving the seeded
		// background attendees show up live, not just after a reload. The title
		// and CTA button fill the whole first viewport, so the date/location/
		// participants grid is off-screen below the fold until we scroll — do
		// that explicitly, in two stops, so both the location tile and the
		// participants tile actually appear on camera instead of just existing
		// in the DOM.
		await page.waitForSelector("text=4 others", { timeout: 10_000 });
		await smoothScrollIntoView(page, page.locator(".feature-grid"));
		await beat(page, 2200);
		await smoothScrollIntoView(page, page.locator("text=4 others"));
		await beat(page, 2200);

		// The "Buy Your Tickets" CTA lives above the grid we just scrolled past —
		// glide back up to it rather than jump-cutting.
		await smoothScrollIntoView(
			page,
			page.locator(`a[href="/events/${event.id}/checkout"]`),
		);
		await beat(page, 600);

		await glideClick(
			page,
			page.locator(`a[href="/events/${event.id}/checkout"]`),
		);
		await page.waitForURL(/\/events\/.+\/checkout/, { timeout: 15_000 });
		await beat(page);

		await glideCheck(
			page,
			page
				.locator(`div:has-text("${PRODUCT_NAME}") input[type="radio"]`)
				.first(),
		);
		await beat(page, 600);
		// Bring a friend — bump quantity from 1 to 2 so a second participant slot
		// opens up on the next step.
		await glideClick(
			page,
			page.getByRole("button", { name: "+", exact: true }),
		);
		await beat(page, 800);

		await glideClick(
			page,
			page.locator('button:has-text("Continue to Participants")'),
		);
		await beat(page, 1000);

		// Slot 1 is auto-locked to Maya (the buyer). Search for the friend she's
		// bringing and add them to slot 2 via the real /api/users/search flow —
		// this is "who I'm going with", not manual name/email entry.
		await glideFill(
			page,
			page.getByPlaceholder("Search participant by name…"),
			"Jordan",
		);
		await page.waitForSelector("text=Jordan Alvarez", { timeout: 8_000 });
		await beat(page, 500);
		await glideClick(page, page.locator("text=Jordan Alvarez").first());
		await beat(page, 800);

		// Reaching step 3 fires createCheckoutSession immediately (a
		// useVisibleTask$ tracking currentStep) — register the listener right
		// now, before the food/photo interactions below, which submit their own
		// POSTs to this same route and would otherwise be mistaken for it if we
		// started listening later.
		const createRespPromise = page.waitForResponse(
			(r) =>
				r.url().includes(`/events/${event.id}/checkout`) &&
				r.request().method() === "POST",
			{ timeout: 15_000 },
		);

		await glideClick(
			page,
			page.locator('button:has-text("Continue to Payment")'),
		);
		await beat(page, 1000);

		// Consent sections required before payment — Maya's food preference and
		// photo consent are unset in the seed, so both render live here. Each
		// step's server action revalidates the checkout loader on success, which
		// flips data.foodPreference/data.photoConsentGiven away from null — that
		// immediately unmounts the whole step (its own "saved" alert never gets
		// a chance to sit on screen), so wait for the section to disappear
		// rather than for a persistent success message.
		await page.waitForSelector("text=Food preferences", { timeout: 10_000 });
		await beat(page, 600);
		await page.locator("select").selectOption("vegetarian");
		await page.waitForSelector("text=Food preferences", {
			state: "detached",
			timeout: 8_000,
		});
		await beat(page, 800);

		await glideClick(page, page.locator('label:has-text("Yes, I consent")'));
		await page.waitForSelector("text=Photo consent", {
			state: "detached",
			timeout: 8_000,
		});
		await beat(page, 1000);

		const createResp = await createRespPromise;
		const createJson = await createResp.json();
		const paymentIntentId = findPaymentIntentId(createJson);
		if (!paymentIntentId) {
			throw new Error(
				`No paymentIntentId returned from server - body=${JSON.stringify(createJson)}`,
			);
		}

		await page.waitForSelector(
			'button:has-text("Complete Payment"):not([disabled])',
			{
				timeout: 5000,
			},
		);
		await beat(page, 1500);

		// Stripe's Payment Element is real Stripe.js hosted in an iframe — even
		// against stripe-mock, it validates card fields client-side before
		// confirmPayment() will proceed. Use the standard Stripe test card.
		const stripeFrame = page
			.frameLocator('iframe[name^="__privateStripeFrame"]')
			.first();
		await glideFill(
			page,
			stripeFrame.locator('input[name="number"]'),
			"4242424242424242",
			{ timeout: 10_000 },
		);
		await beat(page, 400);
		await glideFill(page, stripeFrame.locator('input[name="expiry"]'), "12/34");
		await beat(page, 400);
		await glideFill(page, stripeFrame.locator('input[name="cvc"]'), "123");
		await beat(page, 800);

		await glideClick(page, page.locator('button:has-text("Complete Payment")'));

		const stripeHost = process.env.STRIPE_API_BASE_URL
			? new URL(process.env.STRIPE_API_BASE_URL)
			: new URL("http://localhost:12111");
		await fetch(
			`${stripeHost.origin}/v1/test_helpers/payment_intents/${paymentIntentId}/confirm`,
			{ method: "POST" },
		);

		const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
			apiVersion: "2026-06-24.dahlia",
			host: stripeHost.hostname,
			port: stripeHost.port ? Number(stripeHost.port) : 12111,
			protocol: stripeHost.protocol.replace(":", "") as "http" | "https",
		});
		const pi = (await stripeClient.paymentIntents.retrieve(
			paymentIntentId,
		)) as Stripe.PaymentIntent & {
			amount: number;
			metadata: Record<string, string>;
		};
		pi.amount = Math.round(PRODUCT_PRICE * 2 * 100);
		pi.metadata = {
			eventId: event.id,
			userId: mayaId,
			items: JSON.stringify([{ productId: product.id, quantity: 2 }]),
		};

		const payloadString = JSON.stringify({
			id: `evt_promo_${Date.now()}`,
			type: "payment_intent.succeeded",
			data: { object: pi },
		});
		const sig = stripeClient.webhooks.generateTestHeaderString({
			payload: payloadString,
			secret: process.env.STRIPE_WEBHOOK_SECRET || "",
		});
		await fetch(new URL("/api/webhooks/stripe", page.url()).toString(), {
			method: "POST",
			headers: { "Content-Type": "application/json", "Stripe-Signature": sig },
			body: payloadString,
		});

		await page.waitForSelector("text=Payment Successful!", { timeout: 15_000 });
		await beat(page, 2000);
	} finally {
		await ctx.close();
	}
});

function findPaymentIntentId(obj: unknown): string | null {
	if (!obj || typeof obj !== "object") return null;
	const record = obj as Record<string, unknown>;
	if (typeof record.paymentIntentId === "string") return record.paymentIntentId;
	const keys = Object.keys(record);
	for (let i = 0; i < keys.length; i++) {
		const value = record[keys[i]];
		if (value === "paymentIntentId" && i + 2 < keys.length) {
			const maybeId = record[keys[i + 2]];
			if (typeof maybeId === "string" && maybeId.startsWith("pi_"))
				return maybeId;
		}
		const found = findPaymentIntentId(value);
		if (found) return found;
	}
	return null;
}

/**
 * E2E test seed — self-contained fixture data for the e2e suite. Does not
 * depend on scripts/seed.ts (that script is for local dev/demo content only;
 * e2e tests must not depend on it, since it's free to change without notice).
 *
 * Usage:
 *   npx tsx scripts/seed-test.ts          # add fixtures to the existing DB
 *   npx tsx scripts/seed-test.ts --fresh  # wipe the DB first, then re-migrate
 *
 * --fresh matters here (unlike scripts/seed.ts's own --fresh) because several
 * of the fixtures below (events, transactions/tickets, election cycles) are
 * NOT idempotent — they insert unconditionally rather than checking for an
 * existing row first, so re-running against the same DB without wiping it
 * would duplicate that data. This is what playwright.config.ts's webServer
 * command uses instead of scripts/seed.ts to get a clean e2e DB each run.
 *
 * Adds:
 *  - Admin and Host base users (if not already present)
 *  - QA checkout users (qa.marta, qa.jonas, qa.leonie, qa.tariq)
 *  - user1–user10 test fixture users
 *  - Past Meetup (E2E) event + inventory
 *  - Checkout QA – Multi-Ticket & Capacity event + inventory
 *  - Transactions / tickets for profile-tickets tests
 *  - Board Elections (2024 closed + 2026 open)
 */

import { faker } from "@faker-js/faker";
import Database from "better-sqlite3";
import crypto from "crypto";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import { runMigrations } from "../src/db/migrate.ts";
import * as schema from "../src/db/schema.ts";

dotenv.config();

const DB_PATH = process.env.DB_PATH ?? "my-database.db";
const isFresh = process.argv.includes("--fresh");

if (isFresh && fs.existsSync(DB_PATH)) {
	fs.unlinkSync(DB_PATH);
	if (fs.existsSync(`${DB_PATH}-wal`)) fs.unlinkSync(`${DB_PATH}-wal`);
	if (fs.existsSync(`${DB_PATH}-shm`)) fs.unlinkSync(`${DB_PATH}-shm`);
	console.log(`Deleted existing database: ${DB_PATH}`);
}

runMigrations();

const sqlite = new Database(DB_PATH);
const db = drizzle({ client: sqlite, relations: schema.schemaRelations });

function uuid() {
	return crypto.randomUUID();
}
function now() {
	return new Date().toISOString();
}
function daysFromNow(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() + n);
	return d.toISOString();
}

console.log("Running test seed overlay...");

// ─── Base users (created here directly — no dependency on scripts/seed.ts) ────

let adminUser = db
	.select()
	.from(schema.users)
	.all()
	.find((u) => u.role === "admin" && u.name === "Admin");
let hostUser = db
	.select()
	.from(schema.users)
	.all()
	.find((u) => u.name === "Host");

if (!adminUser) {
	const loginId = uuid();
	db.insert(schema.logins)
		.values({
			id: loginId,
			email: "admin@example.com",
			expiresAt: "2099-01-01T00:00:00.000Z",
		})
		.run();
	const id = uuid();
	db.insert(schema.users)
		.values({
			id,
			name: "Admin",
			familyName: "User",
			role: "admin",
			loginId,
			createdAt: now(),
			updatedAt: now(),
		})
		.run();
	adminUser = db
		.select()
		.from(schema.users)
		.all()
		.find((u) => u.id === id)!;
	console.log("  created admin user 'Admin' (admin@example.com)");
}

if (!hostUser) {
	const loginId = uuid();
	db.insert(schema.logins)
		.values({
			id: loginId,
			email: "host@example.com",
			expiresAt: "2099-01-01T00:00:00.000Z",
		})
		.run();
	const id = uuid();
	db.insert(schema.users)
		.values({
			id,
			name: "Host",
			familyName: "User",
			role: "admin",
			loginId,
			createdAt: now(),
			updatedAt: now(),
		})
		.run();
	hostUser = db
		.select()
		.from(schema.users)
		.all()
		.find((u) => u.id === id)!;
	console.log("  created host user 'Host' (host@example.com)");
}

// ─── Home page ("/") ──────────────────────────────────────────────────────────
// Required plumbing, not demo content: "/" has no dedicated route file — it's
// resolved by the page-builder catch-all (src/routes/[...slug]) same as
// "/news" (see tests/fixtures.ts `ensureNewsPage`). Without a page here the
// server 404s at "/", which breaks Playwright's webServer readiness probe
// (it polls this exact URL) and auth.setup.ts's post-login navigation.

const homeMenuItem = db
	.select()
	.from(schema.menuItems)
	.all()
	.find((m) => m.url === "/");
if (!homeMenuItem) {
	const pageId = uuid();
	db.insert(schema.pages)
		.values({
			id: pageId,
			content: [],
			status: "published",
			createdAt: now(),
			updatedAt: now(),
		})
		.run();
	db.insert(schema.menuItems)
		.values({
			id: uuid(),
			menuName: "main",
			title: "Home",
			url: "/",
			pageId,
			position: 0,
			status: "visible",
			target: "_self",
			createdAt: now(),
			updatedAt: now(),
		})
		.run();
	console.log("  created home page '/'");
}

// ─── Onboarding survey form ───────────────────────────────────────────────────
// Required plumbing, not demo content: /profile/setup (theme/routes/onboarding/
// OnboardingView.tsx) unconditionally reads `form!.schemaJson` once a user still
// needs the survey step, with no null guard — without this system form the
// route throws mid-render. surveys/onboard.json is a real repo file (the
// survey's actual schema), not demo-generated content.

const onboardingForm = db
	.select()
	.from(schema.forms)
	.all()
	.find((f) => f.systemKey === "affilation");
if (!onboardingForm) {
	const onboardJson = JSON.parse(
		fs.readFileSync("surveys/onboard.json", "utf-8"),
	);
	db.insert(schema.forms)
		.values({
			id: uuid(),
			title: "Onboarding Survey",
			slug: "onboarding",
			description:
				"Required during signup — captures how you know us and your academic background.",
			schemaJson: onboardJson,
			visibility: "private",
			scopeType: "global",
			isSystemForm: true,
			allowResubmission: true,
			systemKey: "affilation",
			createdBy: adminUser!.id,
			createdAt: now(),
			updatedAt: now(),
		})
		.run();
	console.log("  created onboarding survey form");
}

// ─── QA checkout users ────────────────────────────────────────────────────────

const qaCheckoutUserDefs = [
	{ name: "Marta", familyName: "Silva", email: "qa.marta@example.com" },
	{ name: "Jonas", familyName: "Berg", email: "qa.jonas@example.com" },
	{ name: "Leonie", familyName: "Dubois", email: "qa.leonie@example.com" },
	{ name: "Tariq", familyName: "Hassan", email: "qa.tariq@example.com" },
] as const;

const qaCheckoutUsers: Array<typeof schema.users.$inferSelect> = [];

for (const qaUser of qaCheckoutUserDefs) {
	let login = db
		.select()
		.from(schema.logins)
		.all()
		.find((l) => l.email === qaUser.email);
	if (!login) {
		const loginId = uuid();
		db.insert(schema.logins)
			.values({
				id: loginId,
				email: qaUser.email,
				expiresAt: "2099-01-01T00:00:00.000Z",
			})
			.run();
		login = db
			.select()
			.from(schema.logins)
			.all()
			.find((l) => l.id === loginId)!;
	}

	let user = db
		.select()
		.from(schema.users)
		.all()
		.find((u) => u.loginId === login!.id);
	if (!user) {
		const id = uuid();
		db.insert(schema.users)
			.values({
				id,
				name: qaUser.name,
				familyName: qaUser.familyName,
				role: "user",
				loginId: login.id,
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
		user = db
			.select()
			.from(schema.users)
			.all()
			.find((u) => u.id === id)!;
	}

	// Ensure consent is set so QA users can reach checkout
	const consent = (user.consent ?? {}) as Record<string, string | null>;
	if (!consent.lastProfileUpdate || !consent.locationVerification) {
		db.update(schema.users)
			.set({
				consent: {
					...consent,
					lastProfileUpdate: now(),
					locationVerification: now(),
					photoConsent: "yes",
					foodPreference: "none",
				},
				updatedAt: now(),
			})
			.where(eq(schema.users.id, user.id))
			.run();
		user = db
			.select()
			.from(schema.users)
			.all()
			.find((u) => u.id === user!.id)!;
	}

	qaCheckoutUsers.push(user);
}
console.log(`  QA checkout users ensured (${qaCheckoutUsers.length})`);

// ─── Test fixture users (user1–10) ────────────────────────────────────────────

const TEST_USER_EMAILS = new Set(
	Array.from({ length: 10 }, (_, i) => `user${i + 1}@example.com`),
);
const testLoginIds = new Set(
	db
		.select()
		.from(schema.logins)
		.all()
		.filter((l) => TEST_USER_EMAILS.has(l.email))
		.map((l) => l.id),
);

let testUsers = db
	.select()
	.from(schema.users)
	.all()
	.filter((u) => u.role === "user" && testLoginIds.has(u.loginId ?? ""));

if (testUsers.length < 10) {
	for (let i = testUsers.length; i < 10; i++) {
		const loginId = uuid();
		const email = `user${i + 1}@example.com`;
		db.insert(schema.logins)
			.values({ id: loginId, email, expiresAt: "2099-01-01T00:00:00.000Z" })
			.run();
		testLoginIds.add(loginId);
		db.insert(schema.users)
			.values({
				id: uuid(),
				name: faker.person.firstName(),
				familyName: faker.person.lastName(),
				role: "user",
				loginId,
				consent: { lastProfileUpdate: now(), locationVerification: now() },
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
	}
	testUsers = db
		.select()
		.from(schema.users)
		.all()
		.filter((u) => u.role === "user" && testLoginIds.has(u.loginId ?? ""));
}
console.log(`  test users: ${testUsers.length}`);

// ─── Resolve group IDs ────────────────────────────────────────────────────────

const allGroups = db.select().from(schema.groups).all();
const groupIds: Record<string, string> = Object.fromEntries(
	allGroups.map((g) => [g.slug, g.id]),
);

// ─── QA Events ───────────────────────────────────────────────────────────────

function resolveAuthor(idx: number) {
	if (idx === -1) return adminUser!.id;
	if (idx === -2) return hostUser!.id;
	return testUsers[idx]?.id ?? adminUser!.id;
}

const qaEventDefs: Array<{
	title: string;
	body: string;
	groupSlug: string | null;
	visibility: "global" | "group-only";
	authorIdx: number;
	startOffsetDays: number;
	durationHours: number;
	city: string;
	country: string;
	address: string;
	latitude: string;
	longitude: string;
}> = [
	{
		title: "Past Meetup (E2E)",
		body: "<p>Past event used for E2E tests.</p>",
		groupSlug: "berlin",
		visibility: "global",
		authorIdx: -1,
		startOffsetDays: -30,
		durationHours: 2,
		city: "Demo City",
		country: "Exampleland",
		address: "Old Venue",
		latitude: "52.5200",
		longitude: "13.4000",
	},
	{
		title: "Checkout QA – Multi-Ticket & Capacity",
		body: "<p>QA event for checkout validation: quantity controls, participant assignment, and capacity limits.</p>",
		groupSlug: "berlin",
		visibility: "global",
		authorIdx: -1,
		startOffsetDays: 16,
		durationHours: 4,
		city: "Demo City",
		country: "Exampleland",
		address: "QA Venue, Demo City",
		latitude: "52.4899",
		longitude: "13.4450",
	},
];

for (const e of qaEventDefs) {
	const existing = db
		.select()
		.from(schema.events)
		.all()
		.find((ev) => ev.title === e.title);
	if (existing) continue;
	const start = daysFromNow(e.startOffsetDays);
	const end = new Date(
		new Date(start).getTime() + e.durationHours * 3600000,
	).toISOString();
	db.insert(schema.events)
		.values({
			id: uuid(),
			title: e.title,
			body: e.body,
			startDate: start,
			endDate: end,
			locationType: "in-person",
			address: e.address || null,
			city: e.city,
			country: e.country,
			longitude: e.longitude,
			latitude: e.latitude,
			onlineUrl: null,
			userId: resolveAuthor(e.authorIdx),
			groupId: e.groupSlug ? (groupIds[e.groupSlug] ?? null) : null,
			visibility: e.visibility,
			createdAt: now(),
			updatedAt: now(),
		})
		.run();
}
console.log("  QA events ensured");

// ─── QA Inventory ─────────────────────────────────────────────────────────────

const allEvents = db.select().from(schema.events).all();
const eventByTitle: Record<string, (typeof allEvents)[0]> = Object.fromEntries(
	allEvents.map((e) => [e.title, e]),
);

function seedInventory(opts: {
	eventTitle: string;
	inventoryName: string;
	maxCapacity: number;
	needsTicket?: boolean;
	salesStartOffset?: number | null;
	salesEndOffset?: number | null;
	products?: Array<{
		name: string;
		price: number;
		maxQuantity: number;
		soldQuantity?: number;
		participantCapacity?: number;
	}>;
}) {
	const e = eventByTitle[opts.eventTitle];
	if (!e) {
		console.warn(`  skipping inventory for missing event '${opts.eventTitle}'`);
		return;
	}
	// Skip if inventory already exists for this event+name
	const existingInv = db
		.select()
		.from(schema.inventoryGroups)
		.all()
		.find((ig) => ig.eventId === e.id && ig.name === opts.inventoryName);
	if (existingInv) return;

	const invId = uuid();
	db.insert(schema.inventoryGroups)
		.values({
			id: invId,
			eventId: e.id,
			name: opts.inventoryName,
			maxCapacity: opts.maxCapacity,
			needsTicket: opts.needsTicket ?? true,
			salesStartDate:
				typeof opts.salesStartOffset === "number"
					? daysFromNow(opts.salesStartOffset)
					: null,
			salesEndDate:
				typeof opts.salesEndOffset === "number"
					? daysFromNow(opts.salesEndOffset)
					: null,
			createdAt: now(),
		})
		.run();

	for (const p of opts.products ?? []) {
		db.insert(schema.products)
			.values({
				id: uuid(),
				eventId: e.id,
				inventoryGroupId: invId,
				name: p.name,
				price: p.price,
				maxQuantity: p.maxQuantity,
				participantCapacity: p.participantCapacity ?? 1,
				features: [],
				imageKey: null,
				stripeProductId: null,
				soldQuantity: p.soldQuantity ?? 0,
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
	}
}

seedInventory({
	eventTitle: "Past Meetup (E2E)",
	inventoryName: "Past Tickets",
	maxCapacity: 30,
	salesStartOffset: -60,
	salesEndOffset: -31,
	products: [
		{ name: "Entry Ticket", price: 5, maxQuantity: 30, soldQuantity: 10 },
	],
});

seedInventory({
	eventTitle: "Checkout QA – Multi-Ticket & Capacity",
	inventoryName: "QA Main Passes",
	maxCapacity: 80,
	salesStartOffset: -5,
	salesEndOffset: 25,
	products: [
		{
			name: "QA Standard Pass",
			price: 19,
			maxQuantity: 6,
			soldQuantity: 1,
			participantCapacity: 1,
		},
		{
			name: "QA One-Time VIP Seat",
			price: 49,
			maxQuantity: 1,
			soldQuantity: 0,
			participantCapacity: 1,
		},
		{
			name: "QA Premium Pass",
			price: 34,
			maxQuantity: 4,
			soldQuantity: 0,
			participantCapacity: 1,
		},
	],
});

seedInventory({
	eventTitle: "Checkout QA – Multi-Ticket & Capacity",
	inventoryName: "QA Team Workshops",
	maxCapacity: 36,
	salesStartOffset: -5,
	salesEndOffset: 25,
	products: [
		{
			name: "QA Pair Workshop (2 participants)",
			price: 54,
			maxQuantity: 6,
			soldQuantity: 1,
			participantCapacity: 2,
		},
		{
			name: "QA Trio Lab (3 participants)",
			price: 72,
			maxQuantity: 4,
			soldQuantity: 0,
			participantCapacity: 3,
		},
	],
});

console.log("  QA inventory seeded");

// ─── Transactions / tickets ───────────────────────────────────────────────────

const allProducts = db.select().from(schema.products).all();
const productsByEvent: Record<string, typeof allProducts> = {};
for (const p of allProducts) {
	if (!productsByEvent[p.eventId]) productsByEvent[p.eventId] = [];
	productsByEvent[p.eventId].push(p);
}

const FIRST_NAMES = [
	"Anna",
	"Ben",
	"Clara",
	"David",
	"Elena",
	"Felix",
	"Greta",
	"Hans",
	"Iris",
	"Jan",
];
const LAST_NAMES = [
	"Müller",
	"Schmidt",
	"Schneider",
	"Fischer",
	"Weber",
	"Meyer",
	"Wagner",
	"Becker",
	"Schulz",
	"Koch",
];

function seedTransaction(opts: {
	eventTitle: string;
	buyerIdx: number;
	items: Array<{ productName: string; quantity: number }>;
	daysAgo: number;
	scanned?: boolean;
	assignedToEmail?: string;
}) {
	const event = eventByTitle[opts.eventTitle];
	if (!event) return;
	const buyer =
		opts.buyerIdx >= 0
			? testUsers[opts.buyerIdx]
			: opts.buyerIdx === -1
				? adminUser!
				: hostUser!;
	if (!buyer) return;
	const eventProducts = productsByEvent[event.id] ?? [];

	const txId = uuid();
	let totalAmount = 0;
	const itemValues: Array<{
		id: string;
		transactionId: string;
		productId: string;
		quantity: number;
		unitPrice: number;
	}> = [];
	const ticketValues: Array<{
		id: string;
		qrCodeUuid: string;
		transactionId: string;
		productId: string;
		eventId: string;
		buyerId: string;
		scannedAt: string | null;
		createdAt: string;
	}> = [];

	for (const item of opts.items) {
		const product = eventProducts.find((p) => p.name === item.productName);
		if (!product) {
			console.warn(
				`  skipping product '${item.productName}' for '${opts.eventTitle}'`,
			);
			continue;
		}
		totalAmount += product.price * item.quantity;
		itemValues.push({
			id: uuid(),
			transactionId: txId,
			productId: product.id,
			quantity: item.quantity,
			unitPrice: product.price,
		});
		for (let q = 0; q < item.quantity; q++) {
			const purchaseDate = new Date();
			purchaseDate.setDate(purchaseDate.getDate() - opts.daysAgo);
			ticketValues.push({
				id: uuid(),
				qrCodeUuid: uuid(),
				transactionId: txId,
				productId: product.id,
				eventId: event.id,
				buyerId: buyer.id,
				scannedAt: opts.scanned
					? new Date(
							new Date(event.startDate).getTime() + 30 * 60000,
						).toISOString()
					: null,
				createdAt: purchaseDate.toISOString(),
			});
		}
	}

	if (itemValues.length === 0) return;

	const fee = totalAmount > 0 ? Math.round(totalAmount * 0.029 * 100) / 100 : 0;
	const purchaseDate = new Date();
	purchaseDate.setDate(purchaseDate.getDate() - opts.daysAgo);

	db.insert(schema.transactions)
		.values({
			id: txId,
			eventId: event.id,
			userId: buyer.id,
			totalAmount,
			transactionFee: fee,
			stripeSessionId: `cs_seed_${uuid().slice(0, 8)}`,
			stripePaymentId: totalAmount > 0 ? `pi_seed_${uuid().slice(0, 8)}` : null,
			paymentDate: purchaseDate.toISOString(),
			createdAt: purchaseDate.toISOString(),
		})
		.run();

	for (const iv of itemValues)
		db.insert(schema.transactionItems).values(iv).run();
	for (const tv of ticketValues) db.insert(schema.tickets).values(tv).run();

	const buyerLogin = buyer.loginId
		? db
				.select()
				.from(schema.logins)
				.all()
				.find((l) => l.id === buyer.loginId)
		: null;
	const buyerEmail = buyerLogin?.email ?? null;

	for (const tv of ticketValues) {
		const product = eventProducts.find((p) => p.id === tv.productId);
		const capacity = product?.participantCapacity ?? 1;
		for (let p = 1; p <= capacity; p++) {
			const first =
				p === 1
					? buyer.name
					: FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
			const last =
				p === 1
					? ((buyer as any).familyName ?? "Seed")
					: LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
			db.insert(schema.ticketParticipants)
				.values({
					id: uuid(),
					ticketId: tv.id,
					participantOrder: p,
					name: `${first} ${last}`,
					email:
						p === 1 && opts.assignedToEmail
							? opts.assignedToEmail
							: p === 1 && buyerEmail
								? buyerEmail
								: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
					userId: p === 1 && !opts.assignedToEmail ? buyer.id : undefined,
				})
				.run();
		}
	}
}

// ── Past event — all tickets scanned ──
seedTransaction({
	eventTitle: "Past Meetup (E2E)",
	buyerIdx: 0,
	items: [{ productName: "Entry Ticket", quantity: 1 }],
	daysAgo: 35,
	scanned: true,
});
seedTransaction({
	eventTitle: "Past Meetup (E2E)",
	buyerIdx: 1,
	items: [{ productName: "Entry Ticket", quantity: 2 }],
	daysAgo: 34,
	scanned: true,
});
seedTransaction({
	eventTitle: "Past Meetup (E2E)",
	buyerIdx: 2,
	items: [{ productName: "Entry Ticket", quantity: 1 }],
	daysAgo: 33,
	scanned: true,
});
seedTransaction({
	eventTitle: "Past Meetup (E2E)",
	buyerIdx: 3,
	items: [{ productName: "Entry Ticket", quantity: 1 }],
	daysAgo: 32,
	scanned: true,
});
seedTransaction({
	eventTitle: "Past Meetup (E2E)",
	buyerIdx: -1,
	items: [{ productName: "Entry Ticket", quantity: 2 }],
	daysAgo: 38,
	scanned: true,
});
seedTransaction({
	eventTitle: "Past Meetup (E2E)",
	buyerIdx: -2,
	items: [{ productName: "Entry Ticket", quantity: 1 }],
	daysAgo: 36,
	scanned: true,
});
seedTransaction({
	eventTitle: "Past Meetup (E2E)",
	buyerIdx: 7,
	items: [{ productName: "Entry Ticket", quantity: 2 }],
	daysAgo: 31,
	scanned: true,
});

// ── Berlin Summer Social — mixed ──
seedTransaction({
	eventTitle: "North Chapter – Summer Social",
	buyerIdx: 0,
	items: [{ productName: "Free Entry", quantity: 1 }],
	daysAgo: 5,
});
seedTransaction({
	eventTitle: "North Chapter – Summer Social",
	buyerIdx: 1,
	items: [{ productName: "Free Entry", quantity: 2 }],
	daysAgo: 4,
});
seedTransaction({
	eventTitle: "North Chapter – Summer Social",
	buyerIdx: 3,
	items: [{ productName: "Free Entry", quantity: 1 }],
	daysAgo: 3,
});
seedTransaction({
	eventTitle: "North Chapter – Summer Social",
	buyerIdx: 5,
	items: [{ productName: "Free Entry", quantity: 1 }],
	daysAgo: 2,
});
seedTransaction({
	eventTitle: "North Chapter – Summer Social",
	buyerIdx: 7,
	items: [{ productName: "Free Entry", quantity: 1 }],
	daysAgo: 2,
});
seedTransaction({
	eventTitle: "North Chapter – Summer Social",
	buyerIdx: 9,
	items: [{ productName: "Free Entry", quantity: 2 }],
	daysAgo: 1,
});
seedTransaction({
	eventTitle: "North Chapter – Summer Social",
	buyerIdx: -1,
	items: [{ productName: "Free Entry", quantity: 1 }],
	daysAgo: 2,
	assignedToEmail: "user1@example.com",
});

// ── Tech Talk — standard + VIP ──
seedTransaction({
	eventTitle: "Tech Talk: AI & Automation",
	buyerIdx: 0,
	items: [{ productName: "Standard Seat", quantity: 1 }],
	daysAgo: 10,
});
seedTransaction({
	eventTitle: "Tech Talk: AI & Automation",
	buyerIdx: 1,
	items: [{ productName: "Standard Seat", quantity: 2 }],
	daysAgo: 8,
});
seedTransaction({
	eventTitle: "Tech Talk: AI & Automation",
	buyerIdx: 5,
	items: [{ productName: "VIP Seat (front row + networking)", quantity: 1 }],
	daysAgo: 7,
});
seedTransaction({
	eventTitle: "Tech Talk: AI & Automation",
	buyerIdx: 7,
	items: [{ productName: "Standard Seat", quantity: 1 }],
	daysAgo: 6,
});
seedTransaction({
	eventTitle: "Tech Talk: AI & Automation",
	buyerIdx: -1,
	items: [{ productName: "VIP Seat (front row + networking)", quantity: 1 }],
	daysAgo: 12,
});
seedTransaction({
	eventTitle: "Tech Talk: AI & Automation",
	buyerIdx: 3,
	items: [{ productName: "Standard Seat", quantity: 2 }],
	daysAgo: 5,
});
seedTransaction({
	eventTitle: "Tech Talk: AI & Automation",
	buyerIdx: -1,
	items: [{ productName: "Standard Seat", quantity: 1 }],
	daysAgo: 3,
	assignedToEmail: "user2@example.com",
});

// ── Welcome Night ──
seedTransaction({
	eventTitle: "New Members Welcome Night",
	buyerIdx: 3,
	items: [{ productName: "Welcome Night Ticket", quantity: 1 }],
	daysAgo: 2,
});
seedTransaction({
	eventTitle: "New Members Welcome Night",
	buyerIdx: 7,
	items: [{ productName: "Welcome Night Ticket", quantity: 1 }],
	daysAgo: 2,
});
seedTransaction({
	eventTitle: "New Members Welcome Night",
	buyerIdx: 9,
	items: [{ productName: "Welcome Night Ticket", quantity: 1 }],
	daysAgo: 1,
});
seedTransaction({
	eventTitle: "New Members Welcome Night",
	buyerIdx: -2,
	items: [{ productName: "Welcome Night Ticket", quantity: 1 }],
	daysAgo: 3,
});
seedTransaction({
	eventTitle: "New Members Welcome Night",
	buyerIdx: -1,
	items: [{ productName: "Welcome Night Ticket", quantity: 1 }],
	daysAgo: 1,
	assignedToEmail: "user3@example.com",
});

// ── Community Hike ──
seedTransaction({
	eventTitle: "South Chapter – Community Hike",
	buyerIdx: 2,
	items: [{ productName: "Hiker Spot", quantity: 1 }],
	daysAgo: 6,
});
seedTransaction({
	eventTitle: "South Chapter – Community Hike",
	buyerIdx: 5,
	items: [{ productName: "Hiker Spot", quantity: 2 }],
	daysAgo: 4,
});
seedTransaction({
	eventTitle: "South Chapter – Community Hike",
	buyerIdx: 7,
	items: [{ productName: "Hiker Spot", quantity: 1 }],
	daysAgo: 3,
});
seedTransaction({
	eventTitle: "South Chapter – Community Hike",
	buyerIdx: -1,
	items: [{ productName: "Hiker Spot", quantity: 1 }],
	daysAgo: 5,
});

// ── Workshop (paid) ──
seedTransaction({
	eventTitle: "Workshop: Public Speaking Skills",
	buyerIdx: 2,
	items: [{ productName: "Workshop Ticket", quantity: 1 }],
	daysAgo: 14,
});
seedTransaction({
	eventTitle: "Workshop: Public Speaking Skills",
	buyerIdx: 5,
	items: [{ productName: "Workshop Ticket", quantity: 1 }],
	daysAgo: 12,
});
seedTransaction({
	eventTitle: "Workshop: Public Speaking Skills",
	buyerIdx: 7,
	items: [{ productName: "Workshop Ticket", quantity: 2 }],
	daysAgo: 10,
});
seedTransaction({
	eventTitle: "Workshop: Public Speaking Skills",
	buyerIdx: 0,
	items: [{ productName: "Workshop Ticket", quantity: 1 }],
	daysAgo: 9,
});
seedTransaction({
	eventTitle: "Workshop: Public Speaking Skills",
	buyerIdx: -1,
	items: [{ productName: "Workshop Ticket", quantity: 2 }],
	daysAgo: 15,
});

// ── Morning Walk ──
seedTransaction({
	eventTitle: "Coast Chapter – Morning Walk",
	buyerIdx: 1,
	items: [{ productName: "Walk Ticket", quantity: 1 }],
	daysAgo: 3,
});
seedTransaction({
	eventTitle: "Coast Chapter – Morning Walk",
	buyerIdx: 6,
	items: [{ productName: "Walk Ticket", quantity: 1 }],
	daysAgo: 2,
});
seedTransaction({
	eventTitle: "Coast Chapter – Morning Walk",
	buyerIdx: 3,
	items: [{ productName: "Walk Ticket", quantity: 1 }],
	daysAgo: 1,
});

// ── Open Meetup ──
seedTransaction({
	eventTitle: "Coast Chapter – Open Meetup",
	buyerIdx: 1,
	items: [{ productName: "Free Entry", quantity: 1 }],
	daysAgo: 4,
});
seedTransaction({
	eventTitle: "Coast Chapter – Open Meetup",
	buyerIdx: 3,
	items: [{ productName: "Free Entry", quantity: 2 }],
	daysAgo: 3,
});
seedTransaction({
	eventTitle: "Coast Chapter – Open Meetup",
	buyerIdx: 6,
	items: [{ productName: "Free Entry", quantity: 1 }],
	daysAgo: 2,
});
seedTransaction({
	eventTitle: "Coast Chapter – Open Meetup",
	buyerIdx: 8,
	items: [{ productName: "Free Entry", quantity: 2 }],
	daysAgo: 1,
});

// ── Networking Breakfast (paid) ──
seedTransaction({
	eventTitle: "Networking Breakfast",
	buyerIdx: 2,
	items: [{ productName: "Breakfast Ticket (incl. food)", quantity: 1 }],
	daysAgo: 7,
});
seedTransaction({
	eventTitle: "Networking Breakfast",
	buyerIdx: 4,
	items: [{ productName: "Breakfast Ticket (incl. food)", quantity: 2 }],
	daysAgo: 5,
});
seedTransaction({
	eventTitle: "Networking Breakfast",
	buyerIdx: 8,
	items: [{ productName: "Breakfast Ticket (incl. food)", quantity: 1 }],
	daysAgo: 4,
});
seedTransaction({
	eventTitle: "Networking Breakfast",
	buyerIdx: -2,
	items: [{ productName: "Breakfast Ticket (incl. food)", quantity: 1 }],
	daysAgo: 6,
});

// ── Startup Pitch Night (paid + free pitcher) ──
seedTransaction({
	eventTitle: "Startup Pitch Night",
	buyerIdx: 4,
	items: [{ productName: "Audience Ticket", quantity: 2 }],
	daysAgo: 10,
});
seedTransaction({
	eventTitle: "Startup Pitch Night",
	buyerIdx: 8,
	items: [{ productName: "Audience Ticket", quantity: 3 }],
	daysAgo: 8,
});
seedTransaction({
	eventTitle: "Startup Pitch Night",
	buyerIdx: 2,
	items: [{ productName: "Audience Ticket", quantity: 2 }],
	daysAgo: 7,
});
seedTransaction({
	eventTitle: "Startup Pitch Night",
	buyerIdx: 6,
	items: [{ productName: "Audience Ticket", quantity: 1 }],
	daysAgo: 6,
});
seedTransaction({
	eventTitle: "Startup Pitch Night",
	buyerIdx: 0,
	items: [
		{ productName: "Pitcher Ticket (present your startup)", quantity: 1 },
	],
	daysAgo: 14,
});
seedTransaction({
	eventTitle: "Startup Pitch Night",
	buyerIdx: 4,
	items: [
		{ productName: "Pitcher Ticket (present your startup)", quantity: 1 },
	],
	daysAgo: 12,
});
seedTransaction({
	eventTitle: "Startup Pitch Night",
	buyerIdx: -1,
	items: [{ productName: "Audience Ticket", quantity: 4 }],
	daysAgo: 9,
});
seedTransaction({
	eventTitle: "Startup Pitch Night",
	buyerIdx: 9,
	items: [
		{ productName: "Pitcher Ticket (present your startup)", quantity: 1 },
	],
	daysAgo: 11,
});

// ── Members Dinner (paid) ──
seedTransaction({
	eventTitle: "West Chapter Members Dinner",
	buyerIdx: 3,
	items: [{ productName: "Dinner Ticket (3-course meal)", quantity: 2 }],
	daysAgo: 5,
});
seedTransaction({
	eventTitle: "West Chapter Members Dinner",
	buyerIdx: 8,
	items: [{ productName: "Dinner Ticket (3-course meal)", quantity: 1 }],
	daysAgo: 4,
});
seedTransaction({
	eventTitle: "West Chapter Members Dinner",
	buyerIdx: -2,
	items: [{ productName: "Dinner Ticket (3-course meal)", quantity: 2 }],
	daysAgo: 6,
});
seedTransaction({
	eventTitle: "West Chapter Members Dinner",
	buyerIdx: 4,
	items: [{ productName: "Dinner Ticket (3-course meal)", quantity: 1 }],
	daysAgo: 3,
});
seedTransaction({
	eventTitle: "West Chapter Members Dinner",
	buyerIdx: 0,
	items: [{ productName: "Dinner Ticket (3-course meal)", quantity: 2 }],
	daysAgo: 7,
});

// ── Meet & Greet ──
seedTransaction({
	eventTitle: "West Chapter – Public Meet & Greet",
	buyerIdx: 3,
	items: [{ productName: "Free Entry", quantity: 1 }],
	daysAgo: 3,
});
seedTransaction({
	eventTitle: "West Chapter – Public Meet & Greet",
	buyerIdx: 8,
	items: [{ productName: "Free Entry", quantity: 1 }],
	daysAgo: 2,
});
seedTransaction({
	eventTitle: "West Chapter – Public Meet & Greet",
	buyerIdx: -2,
	items: [{ productName: "Free Entry", quantity: 1 }],
	daysAgo: 2,
});
seedTransaction({
	eventTitle: "West Chapter – Public Meet & Greet",
	buyerIdx: 4,
	items: [{ productName: "Free Entry", quantity: 1 }],
	daysAgo: 1,
});

// ── Town Hall ──
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: -1,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 10,
});
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: 0,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 8,
});
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: 2,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 7,
});
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: 4,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 6,
});
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: 6,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 5,
});
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: 8,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 4,
});
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: -2,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 3,
});
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: 1,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 2,
});
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: 3,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 2,
});
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: 5,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 1,
});
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: 7,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 1,
});
seedTransaction({
	eventTitle: "All-Groups Online Town Hall",
	buyerIdx: 9,
	items: [{ productName: "Virtual Seat", quantity: 1 }],
	daysAgo: 1,
});

const txCount = db.select().from(schema.transactions).all().length;
const ticketCount = db.select().from(schema.tickets).all().length;
console.log(
	`  transactions seeded (${txCount} transactions, ${ticketCount} tickets)`,
);
console.log("  Checkout QA scenario ready:");
console.log("    Event: Checkout QA – Multi-Ticket & Capacity");
console.log(
	"    Products: QA Standard Pass, QA Premium Pass, QA Pair Workshop (2 participants), QA Trio Lab (3 participants)",
);
console.log(
	"    Search users: Marta Silva, Jonas Berg, Leonie Dubois, Tariq Hassan",
);

// ─── Elections ────────────────────────────────────────────────────────────────

const electionCycleDefs: Array<{
	title: string;
	year: number;
	description: string;
	status: "draft" | "open" | "closed";
	requiredMembershipTier: "associated" | "full" | null;
}> = [
	{
		title: "Board Elections 2024",
		year: 2024,
		description: "Annual board elections for the 2024–2026 term.",
		status: "closed",
		requiredMembershipTier: "full",
	},
	{
		title: "Board Elections 2026",
		year: 2026,
		description:
			"Nominations are open for the 2026–2028 board term. Full members may apply.",
		status: "open",
		requiredMembershipTier: "full",
	},
];

const existingCycles = db.select().from(schema.electionCycles).all();
const cycleIdByTitle: Record<string, string> = {};

for (const c of electionCycleDefs) {
	const existing = existingCycles.find((ec) => ec.title === c.title);
	if (existing) {
		cycleIdByTitle[c.title] = existing.id;
	} else {
		const id = uuid();
		db.insert(schema.electionCycles)
			.values({
				id,
				title: c.title,
				year: c.year,
				description: c.description,
				status: c.status,
				requiredMembershipTier: c.requiredMembershipTier,
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
		cycleIdByTitle[c.title] = id;
	}
}

const positionDefs: Array<{
	cycleTitle: string;
	title: string;
	description: string;
}> = [
	{
		cycleTitle: "Board Elections 2024",
		title: "Board President",
		description: "Leads the board and chairs meetings.",
	},
	{
		cycleTitle: "Board Elections 2024",
		title: "Secretary",
		description: "Manages communication and minutes.",
	},
	{
		cycleTitle: "Board Elections 2026",
		title: "Board President",
		description: "Leads the board and chairs meetings.",
	},
	{
		cycleTitle: "Board Elections 2026",
		title: "Treasurer",
		description: "Oversees finances and budgeting.",
	},
	{
		cycleTitle: "Board Elections 2026",
		title: "Secretary",
		description: "Manages communication and minutes.",
	},
];

const existingPositions = db.select().from(schema.electionPositions).all();
const positionIdByKey: Record<string, string> = {};

for (const p of positionDefs) {
	const cycleId = cycleIdByTitle[p.cycleTitle];
	if (!cycleId) continue;
	const key = `${p.cycleTitle}::${p.title}`;
	const existing = existingPositions.find(
		(ep) => ep.cycleId === cycleId && ep.title === p.title,
	);
	if (existing) {
		positionIdByKey[key] = existing.id;
	} else {
		const id = uuid();
		db.insert(schema.electionPositions)
			.values({
				id,
				cycleId,
				title: p.title,
				description: p.description,
				createdAt: now(),
			})
			.run();
		positionIdByKey[key] = id;
	}
}

const applicationDefs: Array<{
	cycleTitle: string;
	positionTitle: string;
	userIdx: number;
	status: "pending" | "approved" | "rejected";
	adminNote?: string;
}> = [
	{
		cycleTitle: "Board Elections 2024",
		positionTitle: "Board President",
		userIdx: 0,
		status: "approved",
	},
	{
		cycleTitle: "Board Elections 2024",
		positionTitle: "Secretary",
		userIdx: 2,
		status: "approved",
	},
	{
		cycleTitle: "Board Elections 2024",
		positionTitle: "Secretary",
		userIdx: 6,
		status: "rejected",
		adminNote: "Withdrew candidacy before vote.",
	},
	{
		cycleTitle: "Board Elections 2026",
		positionTitle: "Board President",
		userIdx: 0,
		status: "pending",
	},
	{
		cycleTitle: "Board Elections 2026",
		positionTitle: "Board President",
		userIdx: 2,
		status: "pending",
	},
	{
		cycleTitle: "Board Elections 2026",
		positionTitle: "Treasurer",
		userIdx: 1,
		status: "approved",
	},
	{
		cycleTitle: "Board Elections 2026",
		positionTitle: "Secretary",
		userIdx: 6,
		status: "approved",
	},
	{
		cycleTitle: "Board Elections 2026",
		positionTitle: "Secretary",
		userIdx: -1,
		status: "rejected",
		adminNote:
			"Admin cannot serve on the board while also administering the platform.",
	},
];

const existingApplications = db
	.select()
	.from(schema.electionApplications)
	.all();

for (const a of applicationDefs) {
	const cycleId = cycleIdByTitle[a.cycleTitle];
	const positionId = positionIdByKey[`${a.cycleTitle}::${a.positionTitle}`];
	const userId = a.userIdx === -1 ? adminUser!.id : testUsers[a.userIdx]?.id;
	if (!cycleId || !positionId || !userId) continue;
	const exists = existingApplications.find(
		(ea) => ea.positionId === positionId && ea.userId === userId,
	);
	if (exists) continue;
	db.insert(schema.electionApplications)
		.values({
			id: uuid(),
			positionId,
			cycleId,
			userId,
			status: a.status,
			motivationWhy:
				"I am passionate about the community and believe I can contribute meaningfully to its direction and growth.",
			motivationExperience:
				"I have been an active member for several years and have organised multiple events across different cities.",
			motivationGoals:
				"I want to strengthen member engagement, improve transparency in decision-making, and grow our local chapters.",
			adminNote: a.adminNote ?? null,
			createdAt: now(),
			updatedAt: now(),
		})
		.run();
}

const cycleCount = db.select().from(schema.electionCycles).all().length;
const posCount = db.select().from(schema.electionPositions).all().length;
const appCount = db.select().from(schema.electionApplications).all().length;
console.log(
	`  elections seeded (${cycleCount} cycles, ${posCount} positions, ${appCount} applications)`,
);

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log("\n✅ Test seed overlay complete");

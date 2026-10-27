/**
 * Demo data and e2e fixtures of the events module (manifest `seed`, run by scripts/seed.ts and
 * scripts/seed-test.ts after core while the module is active). Loaded lazily by the manifest.
 */
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import {
	ensureWorkflowForm,
	type SeedContext,
	seedPeople,
	slugify,
} from "~/core";
import { eventDebriefFormSeed, eventProposalFormSeed } from "./seed-forms";

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function daysFromNow(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() + n);
	return d.toISOString();
}

/** A free event slug in a scope (the events service's rule: the title's slug, then -2, -3, …). */
function freeEventSlug(
	ctx: SeedContext,
	scopeId: string,
	title: string,
): string {
	const taken = new Set(
		ctx.db
			.select({ slug: ctx.schema.events.slug })
			.from(ctx.schema.events)
			.where(eq(ctx.schema.events.scopeId, scopeId))
			.all()
			.map((r) => r.slug),
	);
	const base = slugify(title) || "event";
	let slug = base;
	for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
	return slug;
}

export async function seedEvents(ctx: SeedContext): Promise<void> {
	// Event proposals and debriefs (spec 5.2): the default forms, active at the root.
	const { admin } = seedPeople(ctx);
	for (const form of [eventProposalFormSeed(), eventDebriefFormSeed()])
		ensureWorkflowForm(ctx.sqlite, ctx.rootScopeId, admin.id, form);
	if (ctx.mode === "demo") await seedDemo(ctx);
	else seedTest(ctx);
}

async function seedDemo(ctx: SeedContext): Promise<void> {
	const { db, schema } = ctx;
	const people = seedPeople(ctx);
	const adminUser = people.admin;
	const hostUser = people.host;
	const testUsers = people.testUsers;
	const groupIds = people.scopeIdsBySlug;
	const rootScope = { id: ctx.rootScopeId };
	const resolveAuthor = people.resolveAuthor;
	const { sqlite, imageKeys } = ctx;
	const testLoginIds = people.testLoginIds;
	const seedEventSlug = (scopeId: string, title: string) =>
		freeEventSlug(ctx, scopeId, title);

	// ─── 9. Events ───────────────────────────────────────────────────────────────

	const eventDefs: Array<{
		title: string;
		body: string;
		groupSlug: string | null;
		visibility: "public" | "members";
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
			title: "Evening Social — Tickets Available",
			body: "<p>A relaxed evening gathering for all community members. Light refreshments included. A great opportunity to meet people and enjoy the community in a social setting.</p>",
			groupSlug: null,
			visibility: "public",
			authorIdx: -1,
			startOffsetDays: 5,
			durationHours: 3,
			city: "Demo City",
			country: "Exampleland",
			address: "The Grand Hall, Demo City",
			latitude: "52.5200",
			longitude: "13.4050",
		},
		{
			title: "North Chapter – Summer Social",
			body: "<p>A free, informal gathering for all North Chapter members. Bring friends, enjoy the weather, and meet your local community.</p>",
			groupSlug: "berlin",
			visibility: "public",
			authorIdx: 0,
			startOffsetDays: 14,
			durationHours: 4,
			city: "Demo City",
			country: "Exampleland",
			address: "Central Park, Demo City",
			latitude: "52.4988",
			longitude: "13.4439",
		},
		{
			title: "Tech Talk: AI & Automation",
			body: "<p>A members-only evening of short talks on artificial intelligence and workflow automation. All skill levels welcome.</p>",
			groupSlug: "berlin",
			visibility: "members",
			authorIdx: 5,
			startOffsetDays: 21,
			durationHours: 3,
			city: "Demo City",
			country: "Exampleland",
			address: "Innovation Hub, Demo City",
			latitude: "52.5369",
			longitude: "13.4008",
		},
		{
			title: "New Members Welcome Night",
			body: "<p>Just joined? Come along to our relaxed welcome evening and meet other members over drinks.</p>",
			groupSlug: "berlin",
			visibility: "members",
			authorIdx: -2,
			startOffsetDays: 7,
			durationHours: 2,
			city: "Demo City",
			country: "Exampleland",
			address: "The Local Bar, Demo City",
			latitude: "52.5396",
			longitude: "13.4119",
		},
		{
			title: "South Chapter – Community Hike",
			body: "<p>A group hike through the local park. All fitness levels welcome — we'll keep a comfortable pace.</p>",
			groupSlug: "munich",
			visibility: "public",
			authorIdx: 2,
			startOffsetDays: 10,
			durationHours: 3,
			city: "Southville",
			country: "Exampleland",
			address: "Riverside Trail, Southville",
			latitude: "48.1545",
			longitude: "11.5956",
		},
		{
			title: "Workshop: Public Speaking Skills",
			body: "<p>A practical workshop on public speaking. Limited to 15 participants for a hands-on experience.</p>",
			groupSlug: "munich",
			visibility: "members",
			authorIdx: 7,
			startOffsetDays: 30,
			durationHours: 2,
			city: "Southville",
			country: "Exampleland",
			address: "Community Centre, Southville",
			latitude: "48.1247",
			longitude: "11.5456",
		},
		{
			title: "Coast Chapter – Morning Walk",
			body: "<p>Start your Saturday right with a 90-minute walk along the waterfront. Relaxed pace, great views.</p>",
			groupSlug: "hamburg",
			visibility: "members",
			authorIdx: 6,
			startOffsetDays: 6,
			durationHours: 2,
			city: "Portstown",
			country: "Exampleland",
			address: "Harbourside, Portstown",
			latitude: "53.5446",
			longitude: "9.9685",
		},
		{
			title: "Coast Chapter – Open Meetup",
			body: "<p>An open-door meetup. No agenda, no pressure — just a chance to connect with fellow members.</p>",
			groupSlug: "hamburg",
			visibility: "public",
			authorIdx: 3,
			startOffsetDays: 18,
			durationHours: 3,
			city: "Portstown",
			country: "Exampleland",
			address: "Waterfront Park, Portstown",
			latitude: "53.5668",
			longitude: "9.9961",
		},
		{
			title: "Networking Breakfast",
			body: "<p>An early-morning networking session over coffee and pastries. Central Chapter members only.</p>",
			groupSlug: "frankfurt",
			visibility: "members",
			authorIdx: 4,
			startOffsetDays: 12,
			durationHours: 2,
			city: "Midtown",
			country: "Exampleland",
			address: "The Grand Café, Midtown",
			latitude: "50.1054",
			longitude: "8.6768",
		},
		{
			title: "Startup Pitch Night",
			body: "<p>Five members pitch their ideas to the group. Attendees vote for their favourite. Light drinks provided.</p>",
			groupSlug: "frankfurt",
			visibility: "public",
			authorIdx: 8,
			startOffsetDays: 25,
			durationHours: 3,
			city: "Midtown",
			country: "Exampleland",
			address: "Coworking Space, Midtown",
			latitude: "50.1044",
			longitude: "8.6513",
		},
		{
			title: "West Chapter Members Dinner",
			body: "<p>A sit-down dinner for West Chapter members. Tickets include a three-course meal.</p>",
			groupSlug: "cologne",
			visibility: "members",
			authorIdx: -2,
			startOffsetDays: 9,
			durationHours: 3,
			city: "Westford",
			country: "Exampleland",
			address: "The Riverside Restaurant, Westford",
			latitude: "50.9417",
			longitude: "6.9590",
		},
		{
			title: "West Chapter – Public Meet & Greet",
			body: "<p>Come and meet the West Chapter! Open to everyone — bring a friend along.</p>",
			groupSlug: "cologne",
			visibility: "public",
			authorIdx: 3,
			startOffsetDays: 35,
			durationHours: 4,
			city: "Westford",
			country: "Exampleland",
			address: "Town Square, Westford",
			latitude: "50.9440",
			longitude: "6.9831",
		},
		{
			title: "Checkout Demo Event",
			body: "<p>Demo event for testing checkout with multiple ticket types and paid product choices.</p>",
			groupSlug: "berlin",
			visibility: "public",
			authorIdx: -1,
			startOffsetDays: 20,
			durationHours: 3,
			city: "Demo City",
			country: "Exampleland",
			address: "Demo Venue, Demo City",
			latitude: "52.5060",
			longitude: "13.3903",
		},
		{
			title: "Photography Workshop — Sold Out",
			body: "<p>A hands-on photography workshop. This event is fully booked — join the waitlist to be notified if spots open up.</p>",
			groupSlug: null,
			visibility: "public",
			authorIdx: -1,
			startOffsetDays: 22,
			durationHours: 3,
			city: "Midtown",
			country: "Exampleland",
			address: "Studio Space, Midtown",
			latitude: "50.1109",
			longitude: "8.6821",
		},
		{
			title: "Annual Community Conference",
			body: "<p>Our biggest event of the year. Ticket sales will open 30 days before the event. Mark your calendar!</p>",
			groupSlug: null,
			visibility: "public",
			authorIdx: -1,
			startOffsetDays: 90,
			durationHours: 8,
			city: "Demo City",
			country: "Exampleland",
			address: "Convention Centre, Demo City",
			latitude: "52.5200",
			longitude: "13.4050",
		},
		{
			title: "All-Groups Online Town Hall",
			body: "<p>Quarterly online town hall open to all groups. Platform updates, Q&A, and upcoming features.</p>",
			groupSlug: null,
			visibility: "public",
			authorIdx: -1,
			startOffsetDays: 45,
			durationHours: 1,
			city: "Online",
			country: "Exampleland",
			address: "",
			latitude: "52.5200",
			longitude: "13.4050",
		},
	];

	for (const e of eventDefs) {
		const start = daysFromNow(e.startOffsetDays);
		const end = new Date(
			new Date(start).getTime() + e.durationHours * 3600000,
		).toISOString();

		db.insert(schema.events)
			.values({
				id: uuid(),
				title: e.title,
				slug: seedEventSlug(
					e.groupSlug ? groupIds[e.groupSlug] : rootScope.id,
					e.title,
				),
				body: e.body,
				startDate: start,
				endDate: end,
				locationType: e.city === "Online" ? "online" : "in-person",
				address: e.address || null,
				city: e.city,
				country: e.country,
				longitude: e.longitude,
				latitude: e.latitude,
				onlineUrl:
					e.city === "Online" ? "https://meet.example.com/town-hall" : null,
				userId: resolveAuthor(e.authorIdx),
				scopeId: e.groupSlug ? groupIds[e.groupSlug] : rootScope.id,
				visibility: e.visibility,
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
	}
	console.log(`  events seeded (${eventDefs.length})`);

	// Updates about events (spec 5.2): an announcement (article) and a short update (note) under the
	// first upcoming events; they show on the event pages and in the news.
	{
		const seededEvents = db
			.select()
			.from(schema.events)
			.all()
			.filter((e) => new Date(e.startDate) > new Date())
			.slice(0, 3);
		for (const [i, evt] of seededEvents.entries()) {
			const at = (minutesAgo: number) =>
				new Date(Date.now() - (i * 10 + minutesAgo) * 60_000).toISOString();
			db.insert(schema.articles)
				.values({
					id: uuid(),
					scopeId: evt.scopeId,
					subjectType: "events:event",
					subjectId: evt.id,
					title: `Announcing: ${evt.title}`,
					body: `<p>${evt.title} is on! Save the date and bring a friend.</p>`,
					visibility: evt.visibility,
					authorId: evt.userId,
					publishedAt: at(5),
					updatedAt: at(5),
				})
				.run();
			db.insert(schema.notes)
				.values({
					id: uuid(),
					scopeId: evt.scopeId,
					subjectType: "events:event",
					subjectId: evt.id,
					body: "<p>Doors open 30 minutes before the start. See you there!</p>",
					visibility: evt.visibility,
					authorId: evt.userId,
					publishedAt: at(2),
					updatedAt: at(2),
				})
				.run();
		}
		console.log(`  event updates seeded (${seededEvents.length * 2})`);
	}

	// ─── 10. Participation statuses ──────────────────────────────────────────────

	const statusEvents = [
		"Evening Social — Tickets Available",
		"North Chapter – Summer Social",
		"Tech Talk: AI & Automation",
		"New Members Welcome Night",
		"South Chapter – Community Hike",
		"Workshop: Public Speaking Skills",
		"Coast Chapter – Morning Walk",
		"Coast Chapter – Open Meetup",
		"Networking Breakfast",
		"Startup Pitch Night",
		"West Chapter Members Dinner",
		"West Chapter – Public Meet & Greet",
		"Photography Workshop — Sold Out",
		"Annual Community Conference",
		"All-Groups Online Town Hall",
	];

	const statuses = ["yes", "no", "maybe"] as const;
	let participationCount = 0;

	for (const eventTitle of statusEvents) {
		const evt = db
			.select()
			.from(schema.events)
			.all()
			.find((e) => e.title === eventTitle);
		if (!evt) continue;

		// Each event gets a random subset of users with varied statuses
		const usersForEvent = [...testUsers, adminUser, hostUser];
		for (let i = 0; i < usersForEvent.length; i++) {
			// Skip some users randomly to create realistic variation
			if (Math.random() < 0.3) continue;
			const existing = db
				.select()
				.from(schema.participationStatus)
				.all()
				.find((p) => p.userId === usersForEvent[i].id && p.eventId === evt.id);
			if (existing) continue;
			db.insert(schema.participationStatus)
				.values({
					id: uuid(),
					userId: usersForEvent[i].id,
					eventId: evt.id,
					status: statuses[i % 3],
					updatedAt: now(),
				})
				.run();
			participationCount++;
		}
	}
	console.log(`  participation statuses seeded (${participationCount})`);

	// ─── 11. Inventory & products (ticket scenarios) ─────────────────────────────

	const allEvents = db.select().from(schema.events).all();
	const eventByTitle: Record<string, (typeof allEvents)[0]> =
		Object.fromEntries(allEvents.map((e) => [e.title, e]));

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
			console.warn(
				`  skipping inventory for missing event '${opts.eventTitle}'`,
			);
			return;
		}

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
					soldQuantity: p.soldQuantity ?? 0,
					createdAt: now(),
					updatedAt: now(),
				})
				.run();
		}
	}

	seedInventory({
		eventTitle: "Evening Social — Tickets Available",
		inventoryName: "Social Evening Tickets",
		maxCapacity: 80,
		salesStartOffset: -14,
		salesEndOffset: 4,
		products: [
			{
				name: "General Admission",
				price: 15,
				maxQuantity: 60,
				soldQuantity: 14,
			},
			{
				name: "VIP Entry (incl. welcome drink)",
				price: 30,
				maxQuantity: 20,
				soldQuantity: 5,
			},
		],
	});

	seedInventory({
		eventTitle: "North Chapter – Summer Social",
		inventoryName: "General Admission",
		maxCapacity: 50,
		salesStartOffset: -7,
		salesEndOffset: 13,
		products: [
			{ name: "Free Entry", price: 0, maxQuantity: 50, soldQuantity: 8 },
		],
	});

	seedInventory({
		eventTitle: "Tech Talk: AI & Automation",
		inventoryName: "Seats",
		maxCapacity: 30,
		salesStartOffset: -5,
		salesEndOffset: 20,
		products: [
			{ name: "Standard Seat", price: 0, maxQuantity: 25, soldQuantity: 6 },
			{
				name: "VIP Seat (front row + networking)",
				price: 15,
				maxQuantity: 5,
				soldQuantity: 2,
			},
		],
	});

	seedInventory({
		eventTitle: "New Members Welcome Night",
		inventoryName: "Welcome Night Spots",
		maxCapacity: 20,
		salesStartOffset: -3,
		salesEndOffset: 6,
		products: [
			{
				name: "Welcome Night Ticket",
				price: 0,
				maxQuantity: 20,
				soldQuantity: 4,
			},
		],
	});

	seedInventory({
		eventTitle: "South Chapter – Community Hike",
		inventoryName: "Hike Spots",
		maxCapacity: 25,
		salesStartOffset: -7,
		salesEndOffset: 9,
		products: [
			{ name: "Hiker Spot", price: 0, maxQuantity: 25, soldQuantity: 5 },
		],
	});

	seedInventory({
		eventTitle: "Workshop: Public Speaking Skills",
		inventoryName: "Workshop Seats",
		maxCapacity: 15,
		salesStartOffset: -10,
		salesEndOffset: 29,
		products: [
			{ name: "Workshop Ticket", price: 10, maxQuantity: 15, soldQuantity: 7 },
		],
	});

	seedInventory({
		eventTitle: "Coast Chapter – Morning Walk",
		inventoryName: "Walk Spots",
		maxCapacity: 15,
		salesStartOffset: -5,
		salesEndOffset: 5,
		products: [
			{ name: "Walk Ticket", price: 0, maxQuantity: 15, soldQuantity: 3 },
		],
	});

	seedInventory({
		eventTitle: "Coast Chapter – Open Meetup",
		inventoryName: "Open Meetup Spots",
		maxCapacity: 40,
		salesStartOffset: -7,
		salesEndOffset: 17,
		products: [
			{ name: "Free Entry", price: 0, maxQuantity: 40, soldQuantity: 6 },
		],
	});

	seedInventory({
		eventTitle: "Networking Breakfast",
		inventoryName: "Breakfast Seats",
		maxCapacity: 20,
		salesStartOffset: -5,
		salesEndOffset: 11,
		products: [
			{
				name: "Breakfast Ticket (incl. food)",
				price: 12,
				maxQuantity: 20,
				soldQuantity: 5,
			},
		],
	});

	seedInventory({
		eventTitle: "Startup Pitch Night",
		inventoryName: "Pitch Night Tickets",
		maxCapacity: 60,
		salesStartOffset: -10,
		salesEndOffset: 24,
		products: [
			{ name: "Audience Ticket", price: 10, maxQuantity: 50, soldQuantity: 12 },
			{
				name: "Pitcher Ticket (present your startup)",
				price: 0,
				maxQuantity: 5,
				soldQuantity: 3,
			},
		],
	});

	seedInventory({
		eventTitle: "West Chapter Members Dinner",
		inventoryName: "Dinner Tickets",
		maxCapacity: 20,
		salesStartOffset: -1,
		salesEndOffset: 8,
		products: [
			{
				name: "Dinner Ticket (3-course meal)",
				price: 25,
				maxQuantity: 20,
				soldQuantity: 8,
			},
		],
	});

	seedInventory({
		eventTitle: "West Chapter – Public Meet & Greet",
		inventoryName: "Meet & Greet Spots",
		maxCapacity: 40,
		salesStartOffset: -5,
		salesEndOffset: 34,
		products: [
			{ name: "Free Entry", price: 0, maxQuantity: 40, soldQuantity: 4 },
		],
	});

	seedInventory({
		eventTitle: "Photography Workshop — Sold Out",
		inventoryName: "Workshop Spots",
		maxCapacity: 10,
		salesStartOffset: -14,
		salesEndOffset: 21,
		products: [
			{ name: "Workshop Ticket", price: 20, maxQuantity: 10, soldQuantity: 10 },
		],
	});

	// Sales open 30 days from now — tests the "coming soon" CTA state
	seedInventory({
		eventTitle: "Annual Community Conference",
		inventoryName: "Conference Passes",
		maxCapacity: 300,
		salesStartOffset: 30,
		salesEndOffset: 89,
		products: [
			{ name: "Early Bird Pass", price: 49, maxQuantity: 100, soldQuantity: 0 },
			{ name: "Standard Pass", price: 79, maxQuantity: 200, soldQuantity: 0 },
		],
	});

	seedInventory({
		eventTitle: "Checkout Demo Event",
		inventoryName: "Main Hall Passes",
		maxCapacity: 120,
		salesStartOffset: -7,
		salesEndOffset: 19,
		products: [
			{ name: "Standard Pass", price: 18, maxQuantity: 80, soldQuantity: 12 },
			{ name: "Premium Pass", price: 35, maxQuantity: 40, soldQuantity: 6 },
		],
	});

	seedInventory({
		eventTitle: "Checkout Demo Event",
		inventoryName: "Workshops",
		maxCapacity: 50,
		salesStartOffset: -7,
		salesEndOffset: 19,
		products: [
			{
				name: "AI Hands-on Workshop",
				price: 22,
				maxQuantity: 30,
				soldQuantity: 4,
			},
			{
				name: "Founder Coaching Session",
				price: 45,
				maxQuantity: 20,
				soldQuantity: 3,
			},
		],
	});

	seedInventory({
		eventTitle: "All-Groups Online Town Hall",
		inventoryName: "Virtual Seats",
		maxCapacity: 200,
		salesStartOffset: -14,
		salesEndOffset: 44,
		products: [
			{ name: "Virtual Seat", price: 0, maxQuantity: 200, soldQuantity: 15 },
		],
	});

	console.log("  inventory & products seeded");

	// ─── 11c. Historical events (past 10 years) with participants ─────────────────

	{
		const bulkUsers = db
			.select()
			.from(schema.users)
			.all()
			.filter(
				(u) =>
					u.id !== adminUser.id &&
					u.id !== hostUser.id &&
					!testLoginIds.has(u.loginId ?? ""),
			);
		const bulkUserPool = bulkUsers.map((u) => u.id);
		const bulkUserById = new Map(bulkUsers.map((u) => [u.id, u]));
		const loginEmailById = new Map(
			db
				.select()
				.from(schema.logins)
				.all()
				.map((l) => [l.id, l.email]),
		);

		function pickBuyers(n: number): string[] {
			return [...bulkUserPool].sort(() => Math.random() - 0.5).slice(0, n);
		}

		function seedHistoricalEvent(opts: {
			title: string;
			body: string;
			groupSlug: string | null;
			startDate: string;
			durationHours: number;
			city: string;
			country: string;
			address: string;
			latitude: string;
			longitude: string;
			locationType: "in-person" | "online";
			onlineUrl?: string;
			products: Array<{
				name: string;
				price: number;
				capacity: number;
				attendees: number;
			}>;
		}) {
			if (
				db
					.select()
					.from(schema.events)
					.all()
					.find((e) => e.title === opts.title)
			)
				return;

			const eventId = uuid();
			const endDate = new Date(
				new Date(opts.startDate).getTime() + opts.durationHours * 3_600_000,
			).toISOString();
			const createdAt = new Date(
				new Date(opts.startDate).getTime() - 30 * 86_400_000,
			).toISOString();

			db.insert(schema.events)
				.values({
					id: eventId,
					title: opts.title,
					slug: seedEventSlug(
						opts.groupSlug ? groupIds[opts.groupSlug] : rootScope.id,
						opts.title,
					),
					body: opts.body,
					startDate: opts.startDate,
					endDate,
					locationType: opts.locationType === "online" ? "online" : "in-person",
					address: opts.address || null,
					city: opts.city,
					country: opts.country,
					longitude: opts.longitude,
					latitude: opts.latitude,
					onlineUrl: opts.onlineUrl ?? null,
					userId: adminUser.id,
					scopeId: opts.groupSlug ? groupIds[opts.groupSlug] : rootScope.id,
					visibility: "public",
					createdAt,
					updatedAt: createdAt,
				})
				.run();

			const invId = uuid();
			db.insert(schema.inventoryGroups)
				.values({
					id: invId,
					eventId,
					name: "Tickets",
					maxCapacity: opts.products.reduce((s, p) => s + p.capacity, 0),
					needsTicket: true,
					salesStartDate: new Date(
						new Date(opts.startDate).getTime() - 60 * 86_400_000,
					).toISOString(),
					salesEndDate: new Date(
						new Date(opts.startDate).getTime() - 86_400_000,
					).toISOString(),
					createdAt,
				})
				.run();

			for (const product of opts.products) {
				const productId = uuid();
				db.insert(schema.products)
					.values({
						id: productId,
						eventId,
						inventoryGroupId: invId,
						name: product.name,
						price: product.price,
						maxQuantity: product.capacity,
						soldQuantity: product.attendees,
						participantCapacity: 1,
						features: [],
						imageKey: null,
						createdAt,
						updatedAt: createdAt,
					})
					.run();

				for (const buyerId of pickBuyers(product.attendees)) {
					const buyer = bulkUserById.get(buyerId)!;
					const buyerEmail = buyer.loginId
						? (loginEmailById.get(buyer.loginId) ?? null)
						: null;
					const purchaseDate = new Date(
						new Date(opts.startDate).getTime() -
							Math.random() * 25 * 86_400_000,
					).toISOString();
					const txId = uuid();
					// A paid order has its core payment (spec 4.7); free ones have none.
					const paymentId = product.price > 0 ? uuid() : null;
					if (paymentId)
						db.insert(schema.payments)
							.values({
								id: paymentId,
								moduleId: "events",
								kind: "tickets",
								refId: txId,
								userId: buyerId,
								status: "paid",
								mode: "payment",
								provider: "stripe",
								providerRef: `cs_hist_${uuid().slice(0, 8)}`,
								providerPaymentRef: `pi_hist_${uuid().slice(0, 8)}`,
								amount: Math.round(product.price * 100),
								currency: "eur",
								lines: [
									{
										label: product.name,
										amount: Math.round(product.price * 100),
										quantity: 1,
									},
								],
								subjectRef: `events:event:${eventId}`,
								createdAt: purchaseDate,
								updatedAt: purchaseDate,
								paidAt: purchaseDate,
							})
							.run();
					db.insert(schema.transactions)
						.values({
							id: txId,
							eventId,
							userId: buyerId,
							totalAmount: product.price,
							transactionFee:
								product.price > 0
									? Math.round(product.price * 0.029 * 100) / 100
									: 0,
							status: "paid",
							paymentId,
							paymentDate: purchaseDate,
							createdAt: purchaseDate,
						})
						.run();
					db.insert(schema.transactionItems)
						.values({
							id: uuid(),
							transactionId: txId,
							productId,
							quantity: 1,
							unitPrice: product.price,
						})
						.run();
					const ticketId = uuid();
					db.insert(schema.tickets)
						.values({
							id: ticketId,
							qrCodeUuid: uuid(),
							transactionId: txId,
							productId,
							eventId,
							buyerId,
							scannedAt: new Date(
								new Date(opts.startDate).getTime() + Math.random() * 3_600_000,
							).toISOString(),
							createdAt: purchaseDate,
						})
						.run();
					db.insert(schema.ticketParticipants)
						.values({
							id: uuid(),
							ticketId,
							participantOrder: 1,
							name: `${buyer.name} ${(buyer as any).familyName ?? ""}`.trim(),
							email: buyerEmail ?? `${buyer.name.toLowerCase()}@example.com`,
							userId: buyerId,
						})
						.run();
				}
			}
		}

		const p = (text: string) => `<p>${text}</p>`;

		// ── Global events ─────────────────────────────────────────────────────────
		seedHistoricalEvent({
			title: "Community Founding Meetup",
			body: p(faker.lorem.paragraph()),
			groupSlug: null,
			startDate: "2015-06-12T18:00:00.000Z",
			durationHours: 3,
			city: "Demo City",
			country: "Exampleland",
			address: "The Foundry, Demo City",
			latitude: "52.5200",
			longitude: "13.4050",
			locationType: "in-person",
			products: [{ name: "Free Entry", price: 0, capacity: 60, attendees: 42 }],
		});
		seedHistoricalEvent({
			title: "Annual Gathering 2016",
			body: p(faker.lorem.paragraph()),
			groupSlug: null,
			startDate: "2016-10-08T10:00:00.000Z",
			durationHours: 8,
			city: "Demo City",
			country: "Exampleland",
			address: "Grand Hall, Demo City",
			latitude: "52.5200",
			longitude: "13.4050",
			locationType: "in-person",
			products: [
				{ name: "Standard Ticket", price: 15, capacity: 80, attendees: 68 },
				{ name: "VIP Ticket", price: 35, capacity: 20, attendees: 14 },
			],
		});
		seedHistoricalEvent({
			title: "Summer Social 2017",
			body: p(faker.lorem.paragraph()),
			groupSlug: null,
			startDate: "2017-07-14T17:00:00.000Z",
			durationHours: 4,
			city: "Demo City",
			country: "Exampleland",
			address: "Riverside Park, Demo City",
			latitude: "52.5200",
			longitude: "13.4050",
			locationType: "in-person",
			products: [{ name: "Free Entry", price: 0, capacity: 80, attendees: 63 }],
		});
		seedHistoricalEvent({
			title: "Annual Conference 2018",
			body: p(faker.lorem.paragraph()),
			groupSlug: null,
			startDate: "2018-09-21T09:00:00.000Z",
			durationHours: 9,
			city: "Demo City",
			country: "Exampleland",
			address: "Convention Centre, Demo City",
			latitude: "52.5200",
			longitude: "13.4050",
			locationType: "in-person",
			products: [
				{ name: "Day Pass", price: 20, capacity: 120, attendees: 98 },
				{ name: "VIP Pass", price: 45, capacity: 30, attendees: 22 },
			],
		});
		seedHistoricalEvent({
			title: "Annual Conference 2019",
			body: p(faker.lorem.paragraph()),
			groupSlug: null,
			startDate: "2019-10-05T09:00:00.000Z",
			durationHours: 10,
			city: "Southville",
			country: "Exampleland",
			address: "Expo Centre, Southville",
			latitude: "41.3851",
			longitude: "2.1734",
			locationType: "in-person",
			products: [
				{ name: "Standard Pass", price: 25, capacity: 160, attendees: 143 },
				{ name: "Premium Pass", price: 55, capacity: 40, attendees: 31 },
			],
		});
		seedHistoricalEvent({
			title: "Online Town Hall — Spring 2020",
			body: p(
				"Our first fully online event, bringing all chapters together virtually.",
			),
			groupSlug: null,
			startDate: "2020-05-20T17:00:00.000Z",
			durationHours: 2,
			city: "Online",
			country: "Exampleland",
			address: "",
			latitude: "52.5200",
			longitude: "13.4050",
			locationType: "online",
			onlineUrl: "https://meet.example.com/townhall-2020",
			products: [
				{ name: "Free Entry", price: 0, capacity: 200, attendees: 147 },
			],
		});
		seedHistoricalEvent({
			title: "Online Workshop — Autumn 2020",
			body: p(faker.lorem.paragraph()),
			groupSlug: null,
			startDate: "2020-11-14T10:00:00.000Z",
			durationHours: 3,
			city: "Online",
			country: "Exampleland",
			address: "",
			latitude: "52.5200",
			longitude: "13.4050",
			locationType: "online",
			onlineUrl: "https://meet.example.com/workshop-2020",
			products: [
				{ name: "Free Entry", price: 0, capacity: 150, attendees: 89 },
			],
		});
		seedHistoricalEvent({
			title: "First In-Person Since 2020",
			body: p(
				"A long-awaited return to meeting face-to-face. " +
					faker.lorem.sentence(),
			),
			groupSlug: null,
			startDate: "2021-07-03T15:00:00.000Z",
			durationHours: 4,
			city: "Demo City",
			country: "Exampleland",
			address: "Rooftop Bar, Demo City",
			latitude: "52.5200",
			longitude: "13.4050",
			locationType: "in-person",
			products: [{ name: "Free Entry", price: 0, capacity: 80, attendees: 71 }],
		});
		seedHistoricalEvent({
			title: "Annual Conference 2022",
			body: p(faker.lorem.paragraph()),
			groupSlug: null,
			startDate: "2022-06-17T09:00:00.000Z",
			durationHours: 10,
			city: "Portstown",
			country: "Exampleland",
			address: "Harbour Convention Centre, Portstown",
			latitude: "51.5074",
			longitude: "-0.1278",
			locationType: "in-person",
			products: [
				{ name: "Standard Pass", price: 30, capacity: 200, attendees: 176 },
				{ name: "VIP Pass", price: 60, capacity: 50, attendees: 38 },
			],
		});
		seedHistoricalEvent({
			title: "Summer Social 2023",
			body: p(faker.lorem.paragraph()),
			groupSlug: null,
			startDate: "2023-07-22T16:00:00.000Z",
			durationHours: 5,
			city: "Demo City",
			country: "Exampleland",
			address: "Rooftop Terrace, Demo City",
			latitude: "52.5200",
			longitude: "13.4050",
			locationType: "in-person",
			products: [
				{ name: "Free Entry", price: 0, capacity: 100, attendees: 83 },
			],
		});
		seedHistoricalEvent({
			title: "Annual Conference 2024",
			body: p(faker.lorem.paragraph()),
			groupSlug: null,
			startDate: "2024-04-19T09:00:00.000Z",
			durationHours: 10,
			city: "Midtown",
			country: "Exampleland",
			address: "Innovation Hub, Midtown",
			latitude: "48.2082",
			longitude: "16.3738",
			locationType: "in-person",
			products: [
				{ name: "Standard Pass", price: 35, capacity: 250, attendees: 214 },
				{ name: "VIP Pass", price: 70, capacity: 50, attendees: 41 },
			],
		});

		// ── Local chapter events ──────────────────────────────────────────────────
		seedHistoricalEvent({
			title: "North Chapter — Spring Social 2016",
			body: p(faker.lorem.paragraph()),
			groupSlug: "berlin",
			startDate: "2016-04-09T14:00:00.000Z",
			durationHours: 3,
			city: "Demo City",
			country: "Exampleland",
			address: "Local Café, Demo City",
			latitude: "59.3293",
			longitude: "18.0686",
			locationType: "in-person",
			products: [{ name: "Free Entry", price: 0, capacity: 30, attendees: 23 }],
		});
		seedHistoricalEvent({
			title: "South Chapter — Hiking Day 2018",
			body: p(faker.lorem.paragraph()),
			groupSlug: "munich",
			startDate: "2018-05-19T09:00:00.000Z",
			durationHours: 5,
			city: "Southville",
			country: "Exampleland",
			address: "Trailhead, Southville",
			latitude: "41.3851",
			longitude: "2.1734",
			locationType: "in-person",
			products: [{ name: "Free Entry", price: 0, capacity: 25, attendees: 19 }],
		});
		seedHistoricalEvent({
			title: "Coast Chapter — Harbour Walk 2019",
			body: p(faker.lorem.paragraph()),
			groupSlug: "hamburg",
			startDate: "2019-09-07T10:00:00.000Z",
			durationHours: 2,
			city: "Portstown",
			country: "Exampleland",
			address: "Harbourside, Portstown",
			latitude: "51.5074",
			longitude: "-0.1278",
			locationType: "in-person",
			products: [{ name: "Free Entry", price: 0, capacity: 20, attendees: 17 }],
		});
		seedHistoricalEvent({
			title: "Central Chapter — Networking Dinner 2021",
			body: p(faker.lorem.paragraph()),
			groupSlug: "frankfurt",
			startDate: "2021-10-14T19:00:00.000Z",
			durationHours: 3,
			city: "Midtown",
			country: "Exampleland",
			address: "The Grand Café, Midtown",
			latitude: "48.2082",
			longitude: "16.3738",
			locationType: "in-person",
			products: [
				{ name: "Dinner Ticket", price: 18, capacity: 40, attendees: 32 },
			],
		});
		seedHistoricalEvent({
			title: "West Chapter — End of Year Party 2022",
			body: p(faker.lorem.paragraph()),
			groupSlug: "cologne",
			startDate: "2022-12-02T19:00:00.000Z",
			durationHours: 4,
			city: "Westford",
			country: "Exampleland",
			address: "Town Square Venue, Westford",
			latitude: "48.8566",
			longitude: "2.3522",
			locationType: "in-person",
			products: [
				{ name: "Entry Ticket", price: 10, capacity: 50, attendees: 41 },
			],
		});
		seedHistoricalEvent({
			title: "North Chapter — Annual Dinner 2023",
			body: p(faker.lorem.paragraph()),
			groupSlug: "berlin",
			startDate: "2023-11-18T19:00:00.000Z",
			durationHours: 3,
			city: "Demo City",
			country: "Exampleland",
			address: "The Riverside Restaurant, Demo City",
			latitude: "59.3293",
			longitude: "18.0686",
			locationType: "in-person",
			products: [
				{ name: "Dinner Ticket", price: 22, capacity: 45, attendees: 38 },
			],
		});
		seedHistoricalEvent({
			title: "South Chapter — Workshop Day 2024",
			body: p(faker.lorem.paragraph()),
			groupSlug: "munich",
			startDate: "2024-02-24T10:00:00.000Z",
			durationHours: 6,
			city: "Southville",
			country: "Exampleland",
			address: "Community Centre, Southville",
			latitude: "41.3851",
			longitude: "2.1734",
			locationType: "in-person",
			products: [
				{ name: "Workshop Ticket", price: 12, capacity: 30, attendees: 27 },
			],
		});

		const pastCount = db
			.select()
			.from(schema.events)
			.all()
			.filter((e) => new Date(e.startDate) < new Date()).length;
		console.log(
			`  historical events seeded (${pastCount} total past events with participants)`,
		);
	}

	// Placeholder images (uploaded by core) for events without one.
	if (imageKeys.length > 0) {
		const eventsNoImg = sqlite
			.prepare(
				"SELECT id FROM events WHERE deleted_at IS NULL AND (image1 IS NULL OR image1 LIKE '%picsum.photos%' OR image2 IS NULL OR image2 LIKE '%picsum.photos%')",
			)
			.all() as Array<{ id: string }>;
		const updateEvent = sqlite.prepare(
			"UPDATE events SET image1 = ?, image2 = ? WHERE id = ?",
		);
		for (let i = 0; i < eventsNoImg.length; i++) {
			updateEvent.run(
				imageKeys[i % imageKeys.length],
				imageKeys[(i + 1) % imageKeys.length],
				eventsNoImg[i].id,
			);
		}

		console.log(`  event images linked (${eventsNoImg.length} events)`);
	}

	// The "Events" page (blocks listing upcoming and past events), linked from both menus.
	{
		const pageId = uuid();
		db.insert(schema.pages)
			.values({
				id: pageId,
				scopeId: rootScope.id,
				slug: "events",
				title: "Events",
				content: [
					{
						id: uuid(),
						componentType: "TitleBlock",
						order: 0,
						data: { text: "Events", level: "1", align: "center" },
					},
					{
						id: uuid(),
						componentType: "SpacerBlock",
						order: 1,
						data: { height: 20 },
					},
					{
						id: uuid(),
						componentType: "UpcomingEventsBlock",
						order: 2,
						data: {},
					},
					{
						id: uuid(),
						componentType: "SpacerBlock",
						order: 3,
						data: { height: 40 },
					},
					{
						id: uuid(),
						componentType: "TitleBlock",
						order: 4,
						data: { text: "Past Events", level: "2", align: "center" },
					},
					{ id: uuid(), componentType: "PastEventsBlock", order: 5, data: {} },
				],
				status: "published",
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
		for (const menuName of ["main", "footer"])
			db.insert(schema.menuItems)
				.values({
					id: uuid(),
					menuName,
					title: "Events",
					url: `ref:core:page:${pageId}`,
					pageId,
					position: 1,
					status: "visible",
					target: "_self",
					createdAt: now(),
					updatedAt: now(),
				})
				.run();
		console.log("  events page and menu items seeded");
	}
}

function seedTest(ctx: SeedContext): void {
	const { db, schema } = ctx;
	const people = seedPeople(ctx);
	// Full user rows: ticket participants are named after their buyer.
	const allUsers = db.select().from(schema.users).all();
	const userRow = (id: string) => {
		const row = allUsers.find((u) => u.id === id);
		if (!row) throw new Error(`Seeded user ${id} is missing`);
		return row;
	};
	const adminUser = userRow(people.admin.id);
	const hostUser = userRow(people.host.id);
	const testUsers = people.testUsers.map((u) => userRow(u.id));
	const groupIds = people.scopeIdsBySlug;
	const rootScope = { id: ctx.rootScopeId };
	const resolveAuthor = people.resolveAuthor;
	const seedEventSlug = (scopeId: string, title: string) =>
		freeEventSlug(ctx, scopeId, title);

	// ─── QA Events ───────────────────────────────────────────────────────────────

	const qaEventDefs: Array<{
		title: string;
		body: string;
		groupSlug: string | null;
		visibility: "public" | "members";
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
			visibility: "public",
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
			visibility: "public",
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
				slug: seedEventSlug(
					e.groupSlug ? (groupIds[e.groupSlug] ?? rootScope.id) : rootScope.id,
					e.title,
				),
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
				scopeId: e.groupSlug
					? (groupIds[e.groupSlug] ?? rootScope.id)
					: rootScope.id,
				visibility: e.visibility,
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
	}
	console.log("  QA events ensured");

	// ─── QA Inventory ─────────────────────────────────────────────────────────────

	const allEvents = db.select().from(schema.events).all();
	const eventByTitle: Record<string, (typeof allEvents)[0]> =
		Object.fromEntries(allEvents.map((e) => [e.title, e]));

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
			console.warn(
				`  skipping inventory for missing event '${opts.eventTitle}'`,
			);
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
					? adminUser
					: hostUser;
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

		const fee =
			totalAmount > 0 ? Math.round(totalAmount * 0.029 * 100) / 100 : 0;
		const purchaseDate = new Date();
		purchaseDate.setDate(purchaseDate.getDate() - opts.daysAgo);

		// A paid order has its core payment (spec 4.7); free ones have none.
		const paymentId = totalAmount > 0 ? uuid() : null;
		if (paymentId)
			db.insert(schema.payments)
				.values({
					id: paymentId,
					moduleId: "events",
					kind: "tickets",
					refId: txId,
					userId: buyer.id,
					status: "paid",
					mode: "payment",
					provider: "stripe",
					providerRef: `cs_seed_${uuid().slice(0, 8)}`,
					providerPaymentRef: `pi_seed_${uuid().slice(0, 8)}`,
					amount: Math.round(totalAmount * 100),
					currency: "eur",
					lines: itemValues.map((iv) => ({
						label:
							eventProducts.find((p) => p.id === iv.productId)?.name ??
							"Ticket",
						amount: Math.round(iv.unitPrice * 100),
						quantity: iv.quantity,
					})),
					subjectRef: `events:event:${event.id}`,
					createdAt: purchaseDate.toISOString(),
					updatedAt: purchaseDate.toISOString(),
					paidAt: purchaseDate.toISOString(),
				})
				.run();
		db.insert(schema.transactions)
			.values({
				id: txId,
				eventId: event.id,
				userId: buyer.id,
				totalAmount,
				transactionFee: fee,
				status: "paid",
				paymentId,
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
}

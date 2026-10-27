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
 *  - Root scope with Admin and Host as root admins (platform admins), and a sample
 *    tree: region "germany" with the chapters "berlin" and "hamburg"
 *  - Admin and Host base users (if not already present)
 *  - QA checkout users (qa.marta, qa.jonas, qa.leonie, qa.tariq)
 *  - user1–user10 test fixture users
 *  - the fixtures of every ACTIVE module (manifest `seed` with mode "test"): events (QA events,
 *    inventory, tickets for profile-tickets tests, proposal/debrief forms), elections (2024
 *    closed + 2026 open board elections)
 */

import { faker } from "@faker-js/faker";
import Database from "better-sqlite3";
import crypto from "crypto";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import { runMigrations } from "../src/core/db/migrate.ts";
import * as schema from "../src/core/db/schema.ts";
import { ensureWorkflowForm, onboardingFormSeed } from "./seed-forms.ts";
import { completeRequirements } from "./seed-requirements.ts";

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

console.log("Running test seed overlay...");

// ─── Base users (created here directly — no dependency on scripts/seed.ts) ────

let adminUser = db
	.select()
	.from(schema.users)
	.all()
	.find((u) => u.name === "Admin");
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

// ─── Scope tree root and platform admins ─────────────────────────────────────
// A platform admin is an admin of the root scope (there is no users.role).

let rootScope = db
	.select()
	.from(schema.scopes)
	.all()
	.find((s) => s.parentId === null);
if (!rootScope) {
	const id = uuid();
	db.insert(schema.scopes)
		.values({
			id,
			parentId: null,
			kind: "root",
			slug: "",
			name: "Community",
			path: "/",
		})
		.run();
	rootScope = db
		.select()
		.from(schema.scopes)
		.all()
		.find((s) => s.id === id)!;
}
for (const admin of [adminUser!, hostUser!]) {
	db.insert(schema.scopeRoles)
		.values({ userId: admin.id, scopeId: rootScope.id, role: "admin" })
		.onConflictDoNothing()
		.run();
}

// ─── Home page ("/") ──────────────────────────────────────────────────────────
// Required plumbing, not demo content: "/" has no dedicated route file — it's
// resolved by the page-builder catch-all (src/routes/[...slug]) same as
// "/news" (see tests/fixtures.ts `ensureNewsPage`). Without a page here the
// server 404s at "/", which breaks Playwright's webServer readiness probe
// (it polls this exact URL) and auth.setup.ts's post-login navigation.

const homePage = db
	.select()
	.from(schema.pages)
	.all()
	.find((p) => p.slug === "" && p.scopeId === rootScope!.id);
if (!homePage) {
	const pageId = uuid();
	db.insert(schema.pages)
		.values({
			id: pageId,
			scopeId: rootScope!.id,
			slug: "",
			title: "Home",
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
			url: `ref:core:page:${pageId}`,
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
// Required plumbing, not demo content: /profile/setup shows the active `core.onboarding`
// form of the root while a user still needs the survey step.

ensureWorkflowForm(sqlite, rootScope!.id, adminUser!.id, onboardingFormSeed());
console.log("  onboarding survey active at the root");

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
	.filter((u) => testLoginIds.has(u.loginId ?? ""));

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
				loginId,
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
	}
	testUsers = db
		.select()
		.from(schema.users)
		.all()
		.filter((u) => testLoginIds.has(u.loginId ?? ""));
}
console.log(`  test users: ${testUsers.length}`);

// ─── Sample scope tree: root → region "Germany" → chapters Berlin, Hamburg ────

function ensureScope(
	parent: { id: string; path: string },
	def: { name: string; slug: string; kind: string },
) {
	const path = `${parent.path}${def.slug}/`;
	const existing = db
		.select()
		.from(schema.scopes)
		.all()
		.find((s) => s.path === path);
	if (existing) return existing;
	const id = uuid();
	db.insert(schema.scopes)
		.values({ id, parentId: parent.id, path, ...def })
		.run();
	return db
		.select()
		.from(schema.scopes)
		.all()
		.find((s) => s.id === id)!;
}
const sampleRegion = ensureScope(rootScope, {
	name: "Germany",
	slug: "germany",
	kind: "region",
});
for (const chapter of [
	{ name: "Berlin", slug: "berlin" },
	{ name: "Hamburg", slug: "hamburg" },
]) {
	ensureScope(sampleRegion, { ...chapter, kind: "chapter" });
}
console.log("  scope tree: root → germany → berlin, hamburg");

// ─── Modules ──────────────────────────────────────────────────────────────────
// Each ACTIVE module's `seed` adds its e2e fixtures (events: QA events, inventory, tickets and
// the proposal/debrief forms; elections: board elections). Imported only now: the registry
// opens the app's DB connection and validates the environment.

{
	const { seedActiveModules } = await import("../src/core/registry/seeds.ts");
	const seeded = await seedActiveModules({
		mode: "test",
		db,
		sqlite,
		schema,
		rootScopeId: rootScope!.id,
		imageKeys: [],
		uploadPublicObject: async () => null,
		log: (message) => console.log(message),
	});
	console.log(`  modules seeded: ${seeded.join(", ") || "none"}`);
}

// ─── User requirements ────────────────────────────────────────────────────────
// Seeded users (admin, QA checkout users, user1–10, …) have completed every requirement
// (spec 4.6), so e2e logins are not sent to /profile/setup or asked at checkout.

completeRequirements(
	sqlite,
	db
		.select({ id: schema.users.id })
		.from(schema.users)
		.all()
		.map((u) => u.id),
);
console.log("  user requirements completed for every seeded user");

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log("\n✅ Test seed overlay complete");

/**
 * Seed script — the single entry point for creating a local dev / E2E database.
 *
 * Usage:
 *   npx tsx scripts/seed.ts          # normal seed (keeps existing DB)
 *   npx tsx scripts/seed.ts --fresh  # deletes DB and starts from scratch
 *
 * Admin account:
 *   email: admin@example.com
 *   Login via magic link (check Mailpit at http://localhost:8025)
 */

import {
	CreateBucketCommand,
	PutBucketPolicyCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { faker } from "@faker-js/faker";
import Database from "better-sqlite3";
import crypto from "crypto";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { runMigrations } from "../src/core/db/migrate.ts";
import * as schema from "../src/core/db/schema.ts";
import { ensureWorkflowForm, onboardingFormSeed } from "./seed-forms.ts";
import { completeRequirements } from "./seed-requirements.ts";

dotenv.config();

const DB_PATH = process.env.DB_PATH ?? "my-database.db";
const isFresh = process.argv.includes("--fresh");

// ─── 1. Optionally wipe the DB ──────────────────────────────────────────────

if (isFresh && fs.existsSync(DB_PATH)) {
	fs.unlinkSync(DB_PATH);
	if (fs.existsSync(`${DB_PATH}-wal`)) fs.unlinkSync(`${DB_PATH}-wal`);
	if (fs.existsSync(`${DB_PATH}-shm`)) fs.unlinkSync(`${DB_PATH}-shm`);
	console.log(`Deleted existing database: ${DB_PATH}`);
}

// ─── 2. Apply committed migrations ──────────────────────────────────────────

console.log("Applying migrations...");
runMigrations();

// ─── 3. Open DB connection ───────────────────────────────────────────────────

const sqlite = new Database(DB_PATH);
const db = drizzle({
	client: sqlite,
	relations: schema.schemaRelations,
});

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function resolveSeedPublicEndpoint(): string {
	const codespaceName = process.env.CODESPACE_NAME;
	const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

	if (codespaceName && forwardingDomain) {
		return `https://${codespaceName}-9000.${forwardingDomain}`;
	}

	return process.env.AWS_ENDPOINT ?? "http://localhost:9000";
}

const seedStorageConfig = {
	region: process.env.AWS_REGION ?? "us-east-1",
	endpoint: process.env.AWS_ENDPOINT ?? "http://localhost:9000",
	publicEndpoint: resolveSeedPublicEndpoint(),
	accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "testtest",
	bucket: process.env.S3_BUCKET ?? "data",
	imagePrefix: process.env.SEED_IMAGE_PREFIX ?? "public/events",
} as const;

const seedImageSources = [
	"https://picsum.photos/id/1011/1400/900.jpg",
	"https://picsum.photos/id/1015/1400/900.jpg",
	"https://picsum.photos/id/1025/1400/900.jpg",
	"https://picsum.photos/id/1035/1400/900.jpg",
	"https://picsum.photos/id/1043/1400/900.jpg",
	"https://picsum.photos/id/1050/1400/900.jpg",
] as const;

async function ensureBucketAndPublicReadPolicy(s3: S3Client): Promise<void> {
	try {
		await s3.send(
			new CreateBucketCommand({ Bucket: seedStorageConfig.bucket }),
		);
	} catch (error: any) {
		const code = error?.name ?? error?.Code;
		if (code !== "BucketAlreadyOwnedByYou" && code !== "BucketAlreadyExists") {
			throw error;
		}
	}

	await s3.send(
		new PutBucketPolicyCommand({
			Bucket: seedStorageConfig.bucket,
			Policy: JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Sid: "PublicReadSeedImages",
						Effect: "Allow",
						Principal: "*",
						Action: ["s3:GetObject"],
						Resource: [`arn:aws:s3:::${seedStorageConfig.bucket}/public/*`],
					},
				],
			}),
		}),
	);
}

/** Uploads one public object for a module's demo data (deal logos); its key, or null on failure. */
async function uploadPublicSeedObject(
	key: string,
	body: Buffer,
	contentType: string,
): Promise<string | null> {
	const s3 = new S3Client({
		region: seedStorageConfig.region,
		endpoint: seedStorageConfig.endpoint,
		forcePathStyle: true,
		credentials: {
			accessKeyId: seedStorageConfig.accessKeyId,
			secretAccessKey: seedStorageConfig.secretAccessKey,
		},
	});
	try {
		await s3.send(
			new PutObjectCommand({
				Bucket: seedStorageConfig.bucket,
				Key: key,
				Body: body,
				ContentType: contentType,
				CacheControl: "public, max-age=86400",
			}),
		);
		return key;
	} catch {
		return null;
	}
}

async function downloadAndUploadSeedImages(): Promise<{
	keys: string[];
	articleKeys: string[];
}> {
	const s3 = new S3Client({
		region: seedStorageConfig.region,
		endpoint: seedStorageConfig.endpoint,
		forcePathStyle: true,
		credentials: {
			accessKeyId: seedStorageConfig.accessKeyId,
			secretAccessKey: seedStorageConfig.secretAccessKey,
		},
	});

	await ensureBucketAndPublicReadPolicy(s3);

	const uploadedKeys: string[] = [];
	// Article images live under their own public prefix (validated by the articles service).
	const articleKeys: string[] = [];

	for (let i = 0; i < seedImageSources.length; i++) {
		const sourceUrl = seedImageSources[i];
		const baseKey = `${seedStorageConfig.imagePrefix}/seed-${i + 1}`;
		const objectKey = `${baseKey}.webp`;
		const smallObjectKey = `${baseKey}-thumb.webp`;

		const response = await fetch(sourceUrl);
		if (!response.ok) {
			throw new Error(
				`Failed to download seed image: ${sourceUrl} (${response.status})`,
			);
		}

		const arrayBuffer = await response.arrayBuffer();
		const sourceBuffer = Buffer.from(arrayBuffer);
		const normalized = await sharp(sourceBuffer).rotate().toBuffer();

		const mainBuffer = await sharp(normalized)
			.resize(1000, 1000, {
				fit: "cover",
				position: "entropy",
			})
			.webp({ quality: 80 })
			.toBuffer();

		const smallBuffer = await sharp(normalized)
			.resize(200, 200, {
				fit: "cover",
				position: "entropy",
			})
			.webp({ quality: 80 })
			.toBuffer();

		await s3.send(
			new PutObjectCommand({
				Bucket: seedStorageConfig.bucket,
				Key: objectKey,
				Body: mainBuffer,
				ContentType: "image/webp",
				CacheControl: "public, max-age=86400",
			}),
		);

		await s3.send(
			new PutObjectCommand({
				Bucket: seedStorageConfig.bucket,
				Key: smallObjectKey,
				Body: smallBuffer,
				ContentType: "image/webp",
				CacheControl: "public, max-age=86400",
			}),
		);

		const articleKey = `public/articles/seed-${i + 1}.webp`;
		await s3.send(
			new PutObjectCommand({
				Bucket: seedStorageConfig.bucket,
				Key: articleKey,
				Body: mainBuffer,
				ContentType: "image/webp",
				CacheControl: "public, max-age=86400",
			}),
		);

		uploadedKeys.push(objectKey);
		articleKeys.push(articleKey);
	}

	return { keys: uploadedKeys, articleKeys };
}

// ─── 4. Base users ───────────────────────────────────────────────────────────

const ADMIN_EMAIL = "admin@example.com";

const existingUsers = db.select().from(schema.users).all();

let adminUser = existingUsers.find((u) => u.name === "Admin");
let hostUser = existingUsers.find((u) => u.name === "Host");

if (!adminUser) {
	const loginId = uuid();
	db.insert(schema.logins)
		.values({
			id: loginId,
			email: ADMIN_EMAIL,
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
	console.log(`  created admin user 'Admin' (${ADMIN_EMAIL})`);
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
	console.log(`  ensured 10 test users exist (now ${testUsers.length})`);
}

console.log(
	`Users: admin=${adminUser.name}, host=${hostUser.name}, test=${testUsers.length}`,
);

// ─── 4b. Bulk fake users (1000 users with European locations) ────────────────

const BULK_USER_TARGET = 1000;

const knownSpecialEmails = new Set([ADMIN_EMAIL, "host@example.com"]);

const allBulkUsers = db
	.select()
	.from(schema.users)
	.all()
	.filter(
		(u) =>
			u.id !== adminUser!.id &&
			u.id !== hostUser!.id &&
			!testLoginIds.has(u.loginId ?? ""),
	);

// All users missing a city (includes admin, host, test, QA users)
const allUsersWithoutCity = db
	.select()
	.from(schema.users)
	.all()
	.filter((u) => !u.city);
const bulkUsersWithoutCity = allUsersWithoutCity; // assign cities to everyone
const neededNew = BULK_USER_TARGET - allBulkUsers.length;

if (neededNew > 0 || bulkUsersWithoutCity.length > 0) {
	console.log("  fetching European city data from natural-earth-vector…");

	const cityGeoJson = await fetch(
		"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson",
	).then((r) => r.json());

	const europeanCities: Array<{ city: string; country: string }> = (
		cityGeoJson.features as any[]
	)
		.filter((f) => {
			const [lon, lat] = f.geometry.coordinates as [number, number];
			return lat >= 34 && lat <= 72 && lon >= -25 && lon <= 45;
		})
		.map((f) => ({
			city: f.properties.name as string,
			country: f.properties.adm0name as string,
		}))
		.filter((c) => c.city && c.country);

	const randomCity = () =>
		europeanCities[Math.floor(Math.random() * europeanCities.length)];

	// Update existing users that are missing a city (raw SQL to guarantee immediate commit)
	const updateCity = sqlite.prepare(
		"UPDATE users SET city = ?, country = ?, updated_at = ? WHERE id = ?",
	);
	let updated = 0;
	for (const u of bulkUsersWithoutCity) {
		const { city, country } = randomCity();
		updateCity.run(city, country, now(), u.id);
		updated++;
	}

	// Create any still-missing users
	let created = 0;
	for (let i = 0; i < neededNew; i++) {
		const { city, country } = randomCity();
		const loginId = uuid();
		const shortId = crypto.randomBytes(4).toString("hex");
		const email = `seed.${shortId}@example.com`;

		db.insert(schema.logins)
			.values({ id: loginId, email, expiresAt: "2099-01-01T00:00:00.000Z" })
			.run();

		db.insert(schema.users)
			.values({
				id: uuid(),
				name: faker.person.firstName(),
				familyName: faker.person.lastName(),
				loginId,
				city,
				country,
				createdAt: faker.date
					.between({ from: "2019-01-01", to: new Date() })
					.toISOString(),
				updatedAt: now(),
			})
			.run();
		created++;
	}

	if (updated) console.log(`  assigned locations to ${updated} existing users`);
	if (created) console.log(`  created ${created} new bulk users`);
} else {
	console.log(
		`  bulk fake users already present with locations (${allBulkUsers.length}), skipping`,
	);
}

// ─── 5. Groups ───────────────────────────────────────────────────────────────

// Chapters per region (slugs are city names; display names are generic). The first five
// (Germany) carry the hand-written memberships and posts below.
const regionDefs = [
	{ name: "Germany", slug: "germany" },
	{ name: "Austria", slug: "austria" },
	{ name: "Switzerland", slug: "switzerland" },
];
const groupDefs: Array<{ name: string; slug: string; region: string }> = [
	{ name: "North Chapter", slug: "berlin", region: "germany" },
	{ name: "South Chapter", slug: "munich", region: "germany" },
	{ name: "Coast Chapter", slug: "hamburg", region: "germany" },
	{ name: "Central Chapter", slug: "frankfurt", region: "germany" },
	{ name: "West Chapter", slug: "cologne", region: "germany" },
	{ name: "East Chapter", slug: "leipzig", region: "germany" },
	{ name: "Southwest Chapter", slug: "stuttgart", region: "germany" },
	{ name: "Elbe Chapter", slug: "dresden", region: "germany" },
	{ name: "Rhine Chapter", slug: "duesseldorf", region: "germany" },
	{ name: "Lower Saxony Chapter", slug: "hanover", region: "germany" },
	{ name: "Franconia Chapter", slug: "nuremberg", region: "germany" },
	{ name: "Danube Chapter", slug: "vienna", region: "austria" },
	{ name: "Styria Chapter", slug: "graz", region: "austria" },
	{ name: "Alpine Chapter", slug: "salzburg", region: "austria" },
	{ name: "Lake Chapter", slug: "zurich", region: "switzerland" },
	{ name: "Capital Chapter", slug: "bern", region: "switzerland" },
	{ name: "Border Chapter", slug: "basel", region: "switzerland" },
];

// Groups are chapters in the scope tree: root → region → the chapters below.
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
		.values({ id, parentId: parent.id, path, createdAt: now(), ...def })
		.run();
	console.log(`  created ${def.kind} '${def.name}' (${path})`);
	return db
		.select()
		.from(schema.scopes)
		.all()
		.find((s) => s.id === id)!;
}

const regionScopes = Object.fromEntries(
	regionDefs.map((r) => [
		r.slug,
		ensureScope(rootScope, { ...r, kind: "region" }),
	]),
);
const groupIds: Record<string, string> = {};
for (const def of groupDefs) {
	groupIds[def.slug] = ensureScope(regionScopes[def.region], {
		name: def.name,
		slug: def.slug,
		kind: "chapter",
	}).id;
}

// ─── 6. Memberships ──────────────────────────────────────────────────────────

const membershipPlan: Array<{ userId: string; groupSlug: string }> = [
	{ userId: testUsers[0]?.id, groupSlug: "berlin" },
	{ userId: testUsers[0]?.id, groupSlug: "munich" },
	{ userId: testUsers[1]?.id, groupSlug: "berlin" },
	{ userId: testUsers[1]?.id, groupSlug: "hamburg" },
	{ userId: testUsers[2]?.id, groupSlug: "munich" },
	{ userId: testUsers[2]?.id, groupSlug: "frankfurt" },
	{ userId: testUsers[3]?.id, groupSlug: "berlin" },
	{ userId: testUsers[3]?.id, groupSlug: "cologne" },
	{ userId: testUsers[3]?.id, groupSlug: "hamburg" },
	{ userId: testUsers[4]?.id, groupSlug: "frankfurt" },
	{ userId: testUsers[4]?.id, groupSlug: "cologne" },
	{ userId: testUsers[5]?.id, groupSlug: "munich" },
	{ userId: testUsers[5]?.id, groupSlug: "berlin" },
	{ userId: testUsers[5]?.id, groupSlug: "cologne" },
	{ userId: testUsers[6]?.id, groupSlug: "hamburg" },
	{ userId: testUsers[6]?.id, groupSlug: "frankfurt" },
	{ userId: testUsers[7]?.id, groupSlug: "berlin" },
	{ userId: testUsers[7]?.id, groupSlug: "munich" },
	{ userId: testUsers[7]?.id, groupSlug: "hamburg" },
	{ userId: testUsers[8]?.id, groupSlug: "cologne" },
	{ userId: testUsers[8]?.id, groupSlug: "frankfurt" },
	{ userId: testUsers[9]?.id, groupSlug: "berlin" },
	{ userId: testUsers[9]?.id, groupSlug: "munich" },
	{ userId: testUsers[9]?.id, groupSlug: "frankfurt" },
	{ userId: adminUser.id, groupSlug: "berlin" },
	{ userId: adminUser.id, groupSlug: "munich" },
	{ userId: hostUser.id, groupSlug: "berlin" },
	{ userId: hostUser.id, groupSlug: "cologne" },
	{ userId: hostUser.id, groupSlug: "frankfurt" },
].filter((m) => m.userId);

for (const m of membershipPlan) {
	db.insert(schema.scopeMemberships)
		.values({
			userId: m.userId,
			scopeId: groupIds[m.groupSlug],
			createdAt: now(),
		})
		.onConflictDoNothing()
		.run();
}
console.log("  memberships seeded");

// Assign bulk faker users to groups (1–2 groups each, random)
{
	const assignedSet = new Set(
		db
			.select()
			.from(schema.scopeMemberships)
			.all()
			.map((m) => `${m.userId}::${m.scopeId}`),
	);
	const groupSlugList = Object.keys(groupIds);
	const bulkUserIds = db
		.select()
		.from(schema.users)
		.all()
		.filter(
			(u) =>
				u.id !== adminUser.id &&
				u.id !== hostUser.id &&
				!testLoginIds.has(u.loginId ?? ""),
		)
		.map((u) => u.id);

	let bulkMembershipCount = 0;
	for (const userId of bulkUserIds) {
		const shuffled = [...groupSlugList].sort(() => Math.random() - 0.5);
		for (let i = 0; i < 1; i++) {
			const groupId = groupIds[shuffled[i]];
			const key = `${userId}::${groupId}`;
			if (assignedSet.has(key)) continue;
			assignedSet.add(key);
			db.insert(schema.scopeMemberships)
				.values({
					userId,
					scopeId: groupId,
					createdAt: faker.date
						.between({ from: "2020-01-01", to: new Date() })
						.toISOString(),
				})
				.run();
			bulkMembershipCount++;
		}
	}
	console.log(
		`  bulk user memberships seeded (${bulkMembershipCount} across ${bulkUserIds.length} users)`,
	);
}

// ─── 7. Representatives ──────────────────────────────────────────────────────
// Ensure every chapter has at least one rep (scope role "representative"). Pick one from
// the chapter's bulk members.
{
	const existingReps = db
		.select()
		.from(schema.scopeRoles)
		.all()
		.filter((r) => r.role === "representative");
	const groupsWithRep = new Set(existingReps.map((r) => r.scopeId));
	const allMemberships = db.select().from(schema.scopeMemberships).all();

	for (const [, groupId] of Object.entries(groupIds)) {
		if (groupsWithRep.has(groupId)) continue;
		// Pick a random member who is not admin/host
		const candidates = allMemberships.filter(
			(m) =>
				m.scopeId === groupId &&
				m.userId !== adminUser.id &&
				m.userId !== hostUser.id,
		);
		if (candidates.length === 0) continue;
		const pick = candidates[Math.floor(Math.random() * candidates.length)];
		db.insert(schema.scopeRoles)
			.values({
				userId: pick.userId,
				scopeId: groupId,
				role: "representative",
				createdAt: now(),
			})
			.run();
		groupsWithRep.add(groupId);
	}
	console.log("  representatives seeded");
}

// ─── 8. Notes and articles ───────────────────────────────────────────────────

// Two core types (spec 4.4): entries with a title are seeded as articles, without as notes.
const postDefs: Array<{
	title: string | null;
	body: string;
	groupSlug: string | null;
	visibility: "public" | "members";
	authorIdx: number;
}> = [
	{
		title: "Welcome to the North Chapter!",
		body: "<p>Hey everyone, great to have you here. This is the official group for all North Chapter members. Introduce yourself and say hello!</p>",
		groupSlug: "berlin",
		visibility: "public",
		authorIdx: 0,
	},
	{
		title: "Spring Meetup Recap",
		body: "<p>What a fantastic evening! We had over 30 people join us for our spring gathering. Thanks to everyone who came out — see you at the next one.</p>",
		groupSlug: "berlin",
		visibility: "members",
		authorIdx: 0,
	},
	{
		title: "New Members – Introduce Yourself!",
		body: "<p>We've had a wave of new sign-ups recently. Drop a reply below and tell the group a bit about yourself — where you're based, what you do, and what you're hoping to get from the community.</p>",
		groupSlug: "berlin",
		visibility: "members",
		authorIdx: 5,
	},
	{
		title: "South Chapter Is Here",
		body: "<p>Welcome to the South Chapter! We're just getting started but already have some exciting events in the pipeline. Watch this space.</p>",
		groupSlug: "munich",
		visibility: "public",
		authorIdx: 2,
	},
	{
		title: "Summer Networking Evening – Interested?",
		body: "<p>We're thinking of organising a casual networking evening this summer. Reply below if you'd be up for it and we'll lock in a date.</p>",
		groupSlug: "munich",
		visibility: "members",
		authorIdx: 7,
	},
	{
		title: "Coast Chapter – Now Open",
		body: "<p>The Coast Chapter is officially open. Whether you're a long-time member or just joined, you're welcome here. Looking forward to building something great together.</p>",
		groupSlug: "hamburg",
		visibility: "public",
		authorIdx: 6,
	},
	{
		title: "Morning Walk – Members Only",
		body: "<p>We're organising a guided walk along the waterfront on Saturday morning. Limited spots — reply to join. Details will be shared with confirmed attendees.</p>",
		groupSlug: "hamburg",
		visibility: "members",
		authorIdx: 3,
	},
	{
		title: "Central Chapter Launches",
		body: "<p>Central Chapter is now live! We're excited to build a local community here. If you're in the area, join the group and say hello.</p>",
		groupSlug: "frankfurt",
		visibility: "public",
		authorIdx: 4,
	},
	{
		title: "Networking Night – Save the Date",
		body: "<p>We're hosting a networking evening for members next month. More details to follow — mark your calendars and spread the word.</p>",
		groupSlug: "frankfurt",
		visibility: "members",
		authorIdx: 8,
	},
	{
		title: "West Chapter – Welcome",
		body: "<p>We're thrilled to open the West Chapter. A space for local members to connect, share, and organise events together.</p>",
		groupSlug: "cologne",
		visibility: "public",
		authorIdx: -2,
	},
	{
		title: "Members-Only Gathering – Limited Spots",
		body: "<p>We're organising a private members-only get-together. Spots are limited so reply early to secure yours. Location shared with confirmed attendees.</p>",
		groupSlug: "cologne",
		visibility: "members",
		authorIdx: 3,
	},
	{
		title: null,
		body: "<p>Reminder: the North Chapter board meets on Thursday at 19:00. Agenda items welcome until Wednesday.</p>",
		groupSlug: "berlin",
		visibility: "public",
		authorIdx: 0,
	},
	{
		title: null,
		body: "<p>Thanks to everyone who helped set up the new chapter pages this week!</p>",
		groupSlug: null,
		visibility: "public",
		authorIdx: -1,
	},
	{
		title: "New Features Live on the Platform",
		body: "<p>We've just rolled out a set of improvements including updated group pages, better event management, and a cleaner profile experience. Let us know what you think.</p>",
		groupSlug: null,
		visibility: "public",
		authorIdx: -1,
	},
	{
		title: "Community Guidelines — Updated",
		body: "<p>We've refreshed our community guidelines to keep things clear and respectful for everyone. Please take a moment to read through them.</p>",
		groupSlug: null,
		visibility: "public",
		authorIdx: -1,
	},
];

function resolveAuthor(idx: number) {
	if (idx === -1) return adminUser!.id;
	if (idx === -2) return hostUser!.id;
	return testUsers[idx]?.id ?? adminUser!.id;
}

postDefs.forEach((p, i) => {
	// Stagger publishedAt by one minute per item so timestamps are strictly
	// distinct and descending. Cursor pagination keys on publishedAt, so a batch
	// sharing the same millisecond would break page boundaries at the ties.
	const publishedAt = new Date(Date.now() - i * 60_000).toISOString();
	const common = {
		id: uuid(),
		body: p.body,
		authorId: resolveAuthor(p.authorIdx),
		scopeId: p.groupSlug ? groupIds[p.groupSlug] : rootScope!.id,
		visibility: p.visibility,
		publishedAt,
		updatedAt: publishedAt,
	};
	if (p.title)
		db.insert(schema.articles)
			.values({ ...common, title: p.title })
			.run();
	else db.insert(schema.notes).values(common).run();
});
console.log(`  notes and articles seeded (${postDefs.length})`);

// Add faker-generated articles for each group (3 per group)
{
	const groupSlugsForPosts = Object.entries(groupIds); // [slug, id][]
	const allGroupPosts = db.select().from(schema.articles).all();
	const fakerPostTopics = [
		() => ({
			title: faker.company.catchPhrase(),
			body: `<p>${faker.lorem.paragraph()}</p><p>${faker.lorem.paragraph()}</p>`,
		}),
		() => ({
			title: `Upcoming: ${faker.lorem.words(3)}`,
			body: `<p>${faker.lorem.paragraph()}</p><p>${faker.lorem.paragraph()}</p>`,
		}),
		() => ({
			title: `Member spotlight: ${faker.person.firstName()} ${faker.person.lastName()}`,
			body: `<p>${faker.lorem.paragraph()}</p><p>${faker.lorem.paragraph()}</p>`,
		}),
		() => ({
			title: `Community update — ${faker.date.month()}`,
			body: `<p>${faker.lorem.paragraph()}</p>`,
		}),
		() => ({
			title: faker.lorem.sentence({ min: 4, max: 7 }).replace(/\.$/, ""),
			body: `<p>${faker.lorem.paragraph()}</p><p>${faker.lorem.paragraph()}</p>`,
		}),
	];

	for (const [, groupId] of groupSlugsForPosts) {
		const existingCount = allGroupPosts.filter(
			(p) => p.scopeId === groupId,
		).length;
		const toAdd = Math.max(0, 3 - existingCount);
		for (let i = 0; i < toAdd; i++) {
			const { title, body } = fakerPostTopics[i % fakerPostTopics.length]();
			const publishedAt = faker.date
				.between({ from: "2023-01-01", to: new Date() })
				.toISOString();
			db.insert(schema.articles)
				.values({
					id: uuid(),
					title,
					body,
					authorId: adminUser.id,
					scopeId: groupId,
					visibility: "public",
					publishedAt,
					updatedAt: publishedAt,
				})
				.run();
		}
	}
	console.log(`  faker articles added per group`);
}

// ─── 12. Placeholder images ──────────────────────────────────────────────────

const { keys: imageKeys, articleKeys } = await downloadAndUploadSeedImages();

const usersWithoutProfile = db
	.select()
	.from(schema.users)
	.all()
	.filter((u) => !u.profilePicture);

for (let i = 0; i < usersWithoutProfile.length; i++) {
	db.update(schema.users)
		.set({
			profilePicture: imageKeys[i % imageKeys.length],
			updatedAt: now(),
		})
		.where(eq(schema.users.id, usersWithoutProfile[i].id))
		.run();
}

const groupsNoImg = sqlite
	.prepare(
		"SELECT id FROM scopes WHERE (image1 IS NULL OR image1 LIKE '%picsum.photos%' OR image2 IS NULL OR image2 LIKE '%picsum.photos%' OR image3 IS NULL OR image3 LIKE '%picsum.photos%')",
	)
	.all() as Array<{ id: string }>;
const updateGroup = sqlite.prepare(
	"UPDATE scopes SET image1 = ?, image2 = ?, image3 = ? WHERE id = ?",
);
for (let i = 0; i < groupsNoImg.length; i++) {
	updateGroup.run(
		imageKeys[i % imageKeys.length],
		imageKeys[(i + 1) % imageKeys.length],
		imageKeys[(i + 2) % imageKeys.length],
		groupsNoImg[i].id,
	);
}

// Every other article gets a featured image (spec 4.4: optional, articles only).
const seededArticles = db.select().from(schema.articles).all();
for (const [i, a] of seededArticles.entries()) {
	if (i % 2 === 1 || a.featuredImage) continue;
	db.update(schema.articles)
		.set({ featuredImage: articleKeys[i % articleKeys.length] })
		.where(eq(schema.articles.id, a.id))
		.run();
}

console.log(
	`  images downloaded/uploaded and linked (${groupsNoImg.length} groups, ${Math.ceil(seededArticles.length / 2)} articles)`,
);
console.log(
	`  user profile pictures assigned (${usersWithoutProfile.length} users)`,
);

// ─── 13. Forms ───────────────────────────────────────────────────────────────

// Workflow forms (a purpose, active at the root) and a public survey.
const onboardingFormId = ensureWorkflowForm(
	sqlite,
	rootScope!.id,
	adminUser!.id,
	onboardingFormSeed(),
);

const surveyDefs: Array<{
	title: string;
	slug: string;
	description: string;
	schema: Record<string, unknown>;
	visibility: "private" | "public";
}> = [
	{
		title: "Community Feedback",
		slug: "community-feedback",
		description:
			"Tell us what you think about the community and how we can improve.",
		schema: {
			pages: [
				{
					name: "feedback_page",
					elements: [
						{
							type: "rating",
							name: "overall_rating",
							title: "How would you rate your overall experience?",
							rateMin: 1,
							rateMax: 5,
							minRateDescription: "Poor",
							maxRateDescription: "Excellent",
							isRequired: true,
						},
						{
							type: "radiogroup",
							name: "how_often",
							title: "How often do you attend events?",
							choices: [
								"Weekly",
								"Monthly",
								"A few times a year",
								"This was my first time",
							],
							isRequired: true,
						},
						{
							type: "comment",
							name: "what_we_do_well",
							title: "What do we do well?",
						},
						{
							type: "comment",
							name: "what_to_improve",
							title: "What could we improve?",
						},
						{
							type: "boolean",
							name: "recommend",
							title: "Would you recommend us to a friend?",
							isRequired: true,
						},
					],
				},
			],
		},
		visibility: "public",
	},
];

for (const f of surveyDefs) {
	const existing = db
		.select()
		.from(schema.forms)
		.all()
		.find((r) => r.slug === f.slug && r.scopeId === rootScope!.id);
	if (existing) continue;
	db.insert(schema.forms)
		.values({
			id: uuid(),
			scopeId: rootScope!.id,
			title: f.title,
			slug: f.slug,
			description: f.description,
			schema: f.schema,
			visibility: f.visibility,
			createdBy: adminUser.id,
			createdAt: now(),
			updatedAt: now(),
		})
		.run();
}
console.log(`  forms seeded (onboarding + ${surveyDefs.length} surveys)`);

// ─── 13b. Onboarding form results ─────────────────────────────────────────────

const onboardingForm = db
	.select()
	.from(schema.forms)
	.all()
	.find((f) => f.id === onboardingFormId);

if (onboardingForm) {
	// Delete any existing form results for test users so they land on the survey fresh.
	const testUserIdsForCleanup = new Set(
		db
			.select()
			.from(schema.users)
			.all()
			.filter((u) => testLoginIds.has(u.loginId ?? ""))
			.map((u) => u.id),
	);
	for (const userId of testUserIdsForCleanup) {
		db.delete(schema.formResults)
			.where(eq(schema.formResults.userId, userId))
			.run();
	}

	const existingResultRows = db
		.select({ userId: schema.formResults.userId })
		.from(schema.formResults)
		.where(eq(schema.formResults.formId, onboardingForm.id))
		.all();

	const alreadySubmitted = new Set(existingResultRows.map((r) => r.userId));

	// Generic placeholder responses — matches the shape the onboarding form expects
	const affiliationPool = [
		{
			status: "graduate",
			faculty: "engineering",
			programme_engineering: "software_engineering",
			degree_level: "master",
			graduation_year: 2022,
			how_did_you_hear: "classmate",
		},
		{
			status: "graduate",
			faculty: "science",
			programme_science: "computer_science",
			degree_level: "master",
			graduation_year: 2021,
			how_did_you_hear: "social_media",
		},
		{
			status: "graduate",
			faculty: "social_sciences",
			programme_social: "economics",
			degree_level: "bachelor",
			graduation_year: 2023,
			how_did_you_hear: "professor",
		},
		{
			status: "graduate",
			faculty: "engineering",
			programme_engineering: "electrical_engineering",
			degree_level: "bachelor",
			graduation_year: 2020,
			how_did_you_hear: "uni_email",
		},
		{
			status: "graduate",
			faculty: "arts",
			programme_arts: "media_studies",
			degree_level: "bachelor",
			graduation_year: 2019,
			how_did_you_hear: "event",
		},
		{
			status: "graduate",
			faculty: "medicine",
			programme_medicine: "medicine",
			degree_level: "master",
			graduation_year: 2024,
			how_did_you_hear: "classmate",
		},
		{
			status: "graduate",
			faculty: "science",
			programme_science: "data_science",
			degree_level: "master",
			graduation_year: 2023,
			how_did_you_hear: "social_media",
		},
		{
			status: "graduate",
			faculty: "law",
			programme_law: "law",
			degree_level: "master",
			graduation_year: 2022,
			how_did_you_hear: "professor",
		},
		{
			status: "graduate",
			faculty: "social_sciences",
			programme_social: "psychology",
			degree_level: "bachelor",
			graduation_year: 2021,
			how_did_you_hear: "event",
		},
		{
			status: "graduate",
			faculty: "engineering",
			programme_engineering: "civil_engineering",
			degree_level: "bachelor",
			graduation_year: 2018,
			how_did_you_hear: "uni_email",
		},
		{
			status: "graduate",
			faculty: "architecture",
			programme_architecture: "architecture",
			degree_level: "master",
			graduation_year: 2020,
			how_did_you_hear: "classmate",
		},
		{
			status: "graduate",
			faculty: "science",
			programme_science: "mathematics",
			degree_level: "phd",
			graduation_year: 2024,
			how_did_you_hear: "professor",
		},
		{
			status: "current_student",
			faculty: "engineering",
			programme_engineering: "software_engineering",
			degree_level: "bachelor",
			current_year: "year_3",
			how_did_you_hear: "classmate",
		},
		{
			status: "current_student",
			faculty: "social_sciences",
			programme_social: "business_admin",
			degree_level: "master",
			current_year: "year_1",
			how_did_you_hear: "social_media",
		},
		{
			status: "current_student",
			faculty: "science",
			programme_science: "computer_science",
			degree_level: "bachelor",
			current_year: "year_2",
			how_did_you_hear: "uni_email",
		},
		{
			status: "current_student",
			faculty: "arts",
			programme_arts: "history",
			degree_level: "bachelor",
			current_year: "year_3",
			how_did_you_hear: "professor",
		},
		{
			status: "current_student",
			faculty: "medicine",
			programme_medicine: "nursing",
			degree_level: "bachelor",
			current_year: "year_4",
			how_did_you_hear: "event",
		},
		{
			status: "current_student",
			faculty: "engineering",
			programme_engineering: "mechanical_engineering",
			degree_level: "master",
			current_year: "postgrad_year",
			how_did_you_hear: "classmate",
		},
		{ status: "staff", faculty: "science", how_did_you_hear: "other" },
		{
			status: "graduate",
			faculty: "social_sciences",
			programme_social: "political_science",
			degree_level: "master",
			graduation_year: 2019,
			how_did_you_hear: "other",
		},
	];

	// Re-query all users now that all bulk users have been inserted
	// Exclude test users so they land on the survey fresh each time.
	const testUserIds = new Set(
		db
			.select()
			.from(schema.users)
			.all()
			.filter((u) => testLoginIds.has(u.loginId ?? ""))
			.map((u) => u.id),
	);
	const usersToSeed = db.select().from(schema.users).all();
	let formResultsInserted = 0;

	for (const user of usersToSeed) {
		if (alreadySubmitted.has(user.id)) continue;
		if (testUserIds.has(user.id)) continue;

		const answers =
			affiliationPool[Math.floor(Math.random() * affiliationPool.length)];

		db.insert(schema.formResults)
			.values({
				id: uuid(),
				formId: onboardingForm.id,
				userId: user.id,
				answers,
				createdAt: now(),
			})
			.run();

		formResultsInserted++;
	}

	console.log(
		`  onboarding form results seeded (${formResultsInserted} inserted)`,
	);
}

// ─── 14. Pages ───────────────────────────────────────────────────────────────

const DEFAULT_TILES = JSON.stringify(
	[
		{
			type: "stat",
			area: "left-top",
			number: "2000+",
			title: "Members",
			description: "A fast growing community that inspires and connects.",
		},
		{
			type: "image",
			area: "left-bottom",
			image: "https://picsum.photos/400/400",
		},
		{
			type: "image",
			area: "middle",
			image: "https://picsum.photos/500/700",
			overlayText:
				"With multiple events all over Europe every year we help to grow your network and make memories.",
		},
		{
			type: "image",
			area: "right-top",
			image: "https://picsum.photos/400/500",
		},
		{
			type: "stat",
			area: "right-bottom",
			number: "10+",
			title: "Local communities",
			description: "Can't find your city yet? Start your own one.",
		},
	],
	null,
	2,
);

const pageDefs: Array<{
	title: string;
	slug: string;
	status: "published" | "draft";
	content: any[];
}> = [
	{
		title: "Home",
		slug: "/",
		status: "published",
		content: [
			{ id: uuid(), componentType: "HeroSectionBlock", order: 0, data: {} },
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 1,
				data: { height: 40 },
			},
			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 2,
				data: { text: "Upcoming Events", level: "2", align: "center" },
			},
			{ id: uuid(), componentType: "UpcomingEventsBlock", order: 3, data: {} },
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 4,
				data: { height: 40 },
			},
			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 5,
				data: { text: "Our Communities", level: "2", align: "center" },
			},
			{ id: uuid(), componentType: "GroupsListBlock", order: 6, data: {} },
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 7,
				data: { height: 40 },
			},
			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 8,
				data: { text: "Latest News", level: "2", align: "center" },
			},
			{
				id: uuid(),
				componentType: "StreamBlock",
				order: 9,
				data: { show: "all", limit: 6 },
			},
		],
	},
	{
		title: "About",
		slug: "/about",
		status: "published",
		content: [
			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 0,
				data: { text: "About This Community", level: "1", align: "center" },
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 1,
				data: { height: 20 },
			},
			{
				id: uuid(),
				componentType: "TextBlock",
				order: 2,
				data: {
					content:
						"<p>We started as a small group of people who wanted to build a space to connect beyond the usual networking events. What began as a single local chapter quickly grew into a network of communities across different cities.</p><p>Today, we are a growing community with members spread across multiple chapters. Our mission is simple: bring people together, foster genuine relationships, and create opportunities for personal and professional growth.</p>",
				},
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
				data: { text: "Our Values", level: "2", align: "left" },
			},
			{
				id: uuid(),
				componentType: "TextBlock",
				order: 5,
				data: {
					content:
						"<p><strong>Openness</strong> — Everyone is welcome, regardless of background or experience.</p><p><strong>Authenticity</strong> — We value real connections over superficial networking.</p><p><strong>Local Roots</strong> — Each chapter is shaped by its members and the place it calls home.</p>",
				},
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 6,
				data: { height: 40 },
			},
			{
				id: uuid(),
				componentType: "QuoteBlock",
				order: 7,
				data: {
					quote: "Great communities are built on trust, not transactions.",
					attribution: "Community Team",
				},
			},
		],
	},
	{
		title: "Block Gallery",
		slug: "/block-gallery",
		status: "published",
		content: [
			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 0,
				data: { text: "Block Gallery", level: "1", align: "center" },
			},
			{
				id: uuid(),
				componentType: "TextBlock",
				order: 1,
				data: {
					content:
						"<p>This page showcases all available content blocks. Open the page builder in the admin to add, remove, and configure them on any page.</p>",
				},
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 2,
				data: { height: 40 },
			},

			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 3,
				data: { text: "Callout", level: "2", align: "left" },
			},
			{
				id: uuid(),
				componentType: "CalloutBlock",
				order: 4,
				data: {
					type: "info",
					title: "Info callout",
					body: "Use this for helpful tips, notes, or supplementary information.",
				},
			},
			{
				id: uuid(),
				componentType: "CalloutBlock",
				order: 5,
				data: {
					type: "tip",
					title: "Tip callout",
					body: "Great for pro tips or recommended actions.",
				},
			},
			{
				id: uuid(),
				componentType: "CalloutBlock",
				order: 6,
				data: {
					type: "warning",
					title: "Warning callout",
					body: "Draws attention to something the reader should be careful about.",
				},
			},
			{
				id: uuid(),
				componentType: "CalloutBlock",
				order: 7,
				data: {
					type: "danger",
					title: "Danger callout",
					body: "Reserved for critical alerts or irreversible actions.",
				},
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 8,
				data: { height: 40 },
			},

			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 9,
				data: { text: "Quote", level: "2", align: "left" },
			},
			{
				id: uuid(),
				componentType: "QuoteBlock",
				order: 10,
				data: {
					quote:
						"The strength of the community is each individual member. The strength of each member is the community.",
					attribution: "Phil Jackson",
					role: "Coach",
				},
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 11,
				data: { height: 40 },
			},

			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 12,
				data: { text: "Accordion", level: "2", align: "left" },
			},
			{
				id: uuid(),
				componentType: "AccordionBlock",
				order: 13,
				data: {
					heading: "Frequently Asked Questions",
					items: JSON.stringify([
						{
							question: "How do I join a chapter?",
							answer:
								"Browse the Communities page and click 'View Group' on any chapter. From there you can join with a single click.",
						},
						{
							question: "Can I create my own chapter?",
							answer:
								"Yes — contact an admin to request a new chapter for your city or region.",
						},
						{
							question: "How do I post an event?",
							answer:
								"Events are created from the admin panel. Navigate to Admin → Events → New Event.",
						},
						{
							question: "Is membership free?",
							answer:
								"Basic membership is always free. Some events may have a ticket price set by the organiser.",
						},
					]),
				},
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 14,
				data: { height: 40 },
			},

			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 15,
				data: { text: "Video", level: "2", align: "left" },
			},
			{
				id: uuid(),
				componentType: "TextBlock",
				order: 16,
				data: {
					content:
						"<p>Paste any YouTube, Vimeo, or direct <code>.mp4</code> URL into the Video block config to embed it.</p>",
				},
			},
			{
				id: uuid(),
				componentType: "VideoBlock",
				order: 17,
				data: {
					url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
					caption: "Example: a YouTube video embedded with the Video block.",
				},
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 18,
				data: { height: 40 },
			},

			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 19,
				data: { text: "Action Button", level: "2", align: "left" },
			},
			{
				id: uuid(),
				componentType: "ActionButtonBlock",
				order: 20,
				data: {
					text: "Go to Admin Panel",
					href: "/admin/root",
					align: "left",
				},
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 21,
				data: { height: 40 },
			},

			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 22,
				data: { text: "Dynamic Blocks", level: "2", align: "left" },
			},
			{
				id: uuid(),
				componentType: "CalloutBlock",
				order: 23,
				data: {
					type: "info",
					title: "Self-fetching blocks",
					body: "The blocks below (Upcoming Events, Groups List, Stream) fetch their own data from the database. Drop them on any page and they update automatically.",
				},
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 24,
				data: { height: 20 },
			},
			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 25,
				data: { text: "Upcoming Events", level: "3", align: "left" },
			},
			{ id: uuid(), componentType: "UpcomingEventsBlock", order: 26, data: {} },
		],
	},
	{
		title: "Communities",
		slug: "/communities",
		status: "published",
		content: [
			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 0,
				data: { text: "Our Communities", level: "1", align: "center" },
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 1,
				data: { height: 20 },
			},
			{
				id: uuid(),
				componentType: "TextBlock",
				order: 2,
				data: {
					content:
						"<p>Find your local community and connect with members in your area.</p>",
				},
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 3,
				data: { height: 40 },
			},
			{ id: uuid(), componentType: "GroupsListBlock", order: 4, data: {} },
		],
	},
	{
		title: "News",
		slug: "/news",
		status: "published",
		content: [
			{
				id: uuid(),
				componentType: "TitleBlock",
				order: 0,
				data: { text: "News", level: "1", align: "center" },
			},
			{
				id: uuid(),
				componentType: "SpacerBlock",
				order: 1,
				data: { height: 20 },
			},
			{
				id: uuid(),
				componentType: "StreamBlock",
				order: 2,
				data: { show: "all", limit: 10 },
			},
		],
	},
];

// Create pages and capture their IDs keyed by URL (slug), so menu items can link back.
const pageIdByUrl = new Map<string, string>();

for (const p of pageDefs) {
	const pageId = uuid();
	db.insert(schema.pages)
		.values({
			id: pageId,
			scopeId: rootScope!.id,
			slug: p.slug.replace(/^\/+/, ""),
			title: p.title,
			content: p.content,
			status: p.status,
			createdAt: now(),
			updatedAt: now(),
		})
		.run();
	pageIdByUrl.set(p.slug, pageId);
}
console.log(`  pages seeded (${pageDefs.length})`);

// ─── 15. Menu items ──────────────────────────────────────────────────────────

// Pages that have a builder-managed content page are linked via pageId. Modules add their own
// entries (Events, Jobs, Deals) in their seeds.
// Footer-only items (Contact, Privacy, Terms) are plain links with no page.
const menuDefs: Array<{
	title: string;
	url: string;
	position: number;
	menuName: string;
	hasPage?: boolean;
}> = [
	{ menuName: "main", title: "Home", url: "/", position: 0, hasPage: true },
	{
		menuName: "main",
		title: "Communities",
		url: "/communities",
		position: 2,
		hasPage: true,
	},
	{ menuName: "main", title: "News", url: "/news", position: 3, hasPage: true },
	{
		menuName: "main",
		title: "About",
		url: "/about",
		position: 5,
		hasPage: true,
	},
	{ menuName: "footer", title: "Home", url: "/", position: 0, hasPage: true },
	{
		menuName: "footer",
		title: "Communities",
		url: "/communities",
		position: 2,
		hasPage: true,
	},
	{
		menuName: "footer",
		title: "News",
		url: "/news",
		position: 3,
		hasPage: true,
	},
	{
		menuName: "footer",
		title: "About",
		url: "/about",
		position: 6,
		hasPage: true,
	},
	{
		menuName: "footer",
		title: "Block Gallery",
		url: "/block-gallery",
		position: 7,
		hasPage: true,
	},
];

for (const m of menuDefs) {
	const pageId = m.hasPage ? (pageIdByUrl.get(m.url) ?? null) : null;
	db.insert(schema.menuItems)
		.values({
			id: uuid(),
			menuName: m.menuName,
			title: m.title,
			// Internal links are stored as references (spec 4.3); the rest are fixed paths.
			url: pageId ? `ref:core:page:${pageId}` : m.url,
			pageId,
			position: m.position,
			status: "visible",
			target: "_self",
			createdAt: now(),
			updatedAt: now(),
		})
		.run();
}
console.log(`  menu items seeded (${menuDefs.length})`);

// ─── 17b. Tag definitions ─────────────────────────────────────────────────────

const tagDefDefs: Array<{
	slug: string;
	label: string;
	category: "board" | "qualification" | "participation" | "custom";
	description: string;
}> = [
	// Board
	{
		slug: "board-member",
		label: "Board Member",
		category: "board",
		description: "Serves on the organisation's board.",
	},
	{
		slug: "board-president",
		label: "President",
		category: "board",
		description: "President of the board.",
	},
	{
		slug: "board-secretary",
		label: "Secretary",
		category: "board",
		description: "Secretary of the board.",
	},
	{
		slug: "board-treasurer",
		label: "Treasurer",
		category: "board",
		description: "Treasurer of the board.",
	},
	// Participation
	{
		slug: "event-speaker",
		label: "Event Speaker",
		category: "participation",
		description: "Has spoken at one of our events.",
	},
	{
		slug: "event-volunteer",
		label: "Event Volunteer",
		category: "participation",
		description: "Has volunteered at one of our events.",
	},
	{
		slug: "program-graduate",
		label: "Program Graduate",
		category: "participation",
		description: "Completed one of our programs.",
	},
	// Custom
	{
		slug: "mentor",
		label: "Mentor",
		category: "custom",
		description: "Active mentor in the community.",
	},
	{
		slug: "ambassador",
		label: "Ambassador",
		category: "custom",
		description: "Community ambassador in their city or region.",
	},
	{
		slug: "chapter-lead",
		label: "Chapter Lead",
		category: "custom",
		description: "Leads a local chapter.",
	},
	{
		slug: "founding-member",
		label: "Founding Member",
		category: "custom",
		description: "Was part of the community from the very beginning.",
	},
];

for (const def of tagDefDefs) {
	const exists = db
		.select()
		.from(schema.tagDefinitions)
		.all()
		.find((d) => d.slug === def.slug);
	if (!exists) {
		db.insert(schema.tagDefinitions)
			.values({
				id: uuid(),
				slug: def.slug,
				label: def.label,
				category: def.category,
				description: def.description,
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
	}
}
console.log(`  tag definitions seeded (${tagDefDefs.length})`);

// ─── Modules ─────────────────────────────────────────────────────────────────
// Each ACTIVE module's `seed` adds its demo data (spec 6): events, deals, jobs, qualifications.
// Imported only now: the registry opens the app's DB connection and validates the environment.

{
	const { seedActiveModules } = await import("../src/core/registry/seeds.ts");
	const seeded = await seedActiveModules({
		mode: "demo",
		db,
		sqlite,
		schema,
		rootScopeId: rootScope.id,
		imageKeys,
		uploadPublicObject: (key, body, contentType) =>
			uploadPublicSeedObject(key, body, contentType),
		log: (message) => console.log(message),
	});
	console.log(`  modules seeded: ${seeded.join(", ") || "none"}`);
}

// ─── User requirements ───────────────────────────────────────────────────────
// Every seeded user has completed profile basics, location, the onboarding survey and the
// event checkout questions (spec 4.6), so logging in as any of them is not gated.

completeRequirements(
	sqlite,
	db
		.select({ id: schema.users.id })
		.from(schema.users)
		.all()
		.map((u) => u.id),
);
console.log("  user requirements completed for every seeded user");

// ─── Done ────────────────────────────────────────────────────────────────────

const counts = {
	users: db.select().from(schema.users).all().length,
	scopes: db.select().from(schema.scopes).all().length,
	memberships: db.select().from(schema.scopeMemberships).all().length,
	scopeRoles: db.select().from(schema.scopeRoles).all().length,
	notes: db.select().from(schema.notes).all().length,
	articles: db.select().from(schema.articles).all().length,
	pages: db.select().from(schema.pages).all().length,
	menuItems: db.select().from(schema.menuItems).all().length,
	forms: db.select().from(schema.forms).all().length,
	userMemberships: db.select().from(schema.userMemberships).all().length,
	userTags: db.select().from(schema.userTags).all().length,
};

console.log("\n✅ Seed complete:");
for (const [k, v] of Object.entries(counts)) {
	console.log(`   ${k}: ${v}`);
}

sqlite.close();

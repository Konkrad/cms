/**
 * Promo-video seed — self-contained cast for the marketing-site recordings in
 * scripts/promo-videos/. Does not depend on scripts/seed.ts (dev/demo content,
 * free to change) or scripts/seed-test.ts (e2e fixtures) — this is its own
 * fixed, named cast so the recorded clips show a real-looking community
 * instead of "user1"/"Admin User" placeholders.
 *
 * Deliberately does NOT create the event itself or any participation_status
 * rows: events-admin-flow.spec.ts creates the event live (that's the point of
 * the recording), and events-member-flow.spec.ts inserts participation_status
 * for the background cast once that event exists — making the second video a
 * real dependency on the first having already run, not just a shared premise.
 *
 * Usage:
 *   npx tsx scripts/seed-promo.ts          # add cast to the existing DB
 *   npx tsx scripts/seed-promo.ts --fresh  # wipe the DB first, then re-migrate
 */

import crypto from "node:crypto";
import fs from "node:fs";
import {
	CreateBucketCommand,
	PutBucketPolicyCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import sharp from "sharp";
import { runMigrations } from "../src/db/migrate.ts";

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

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 5000");

function uuid() {
	return crypto.randomUUID();
}
function now() {
	return new Date().toISOString();
}

// ─── Profile photos ──────────────────────────────────────────────────────────
// Real (public-domain-style) face photos so the recordings — especially the
// "who's going" avatar stack and the participant search results — look like a
// real community instead of blank initial circles. Mirrors scripts/seed.ts's
// image-upload pattern but follows the actual documented prefix convention
// (see CLAUDE.md): full photo under private/profile-pictures/ (presigned at
// read time), thumbnail under public/profile-pictures/ (served directly) —
// scripts/seed.ts's own bulk-user shortcut reuses public/events/ keys for
// both, which works only because it never sets profilePictureSmall and relies
// on deriveThumbnailKey's public-key assumption; doing it correctly here means
// the small key is explicit and always resolves.

const seedStorageConfig = {
	region: process.env.AWS_REGION ?? "us-east-1",
	endpoint: process.env.AWS_ENDPOINT ?? "http://localhost:9000",
	accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "testtest",
	bucket: process.env.S3_BUCKET ?? "data",
} as const;

async function ensureBucketAndPublicReadPolicy(s3: S3Client): Promise<void> {
	try {
		await s3.send(
			new CreateBucketCommand({ Bucket: seedStorageConfig.bucket }),
		);
	} catch (error) {
		const code =
			error instanceof Object
				? ((error as { name?: string; Code?: string }).name ??
					(error as { name?: string; Code?: string }).Code)
				: undefined;
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

/** Uploads a deterministic real-face photo for `email` and returns the two DB keys. */
async function uploadProfilePhoto(
	email: string,
	slug: string,
	s3: S3Client,
): Promise<{ profilePicture: string; profilePictureSmall: string }> {
	// pravatar.cc serves real (randomuser.me-sourced) face photos and returns
	// the same photo for the same `u` seed every time — deterministic across
	// re-seeds without us needing to store/manage source images ourselves.
	const response = await fetch(
		`https://i.pravatar.cc/500?u=${encodeURIComponent(email)}`,
	);
	if (!response.ok) {
		throw new Error(
			`Failed to download avatar for ${email} (${response.status})`,
		);
	}
	const sourceBuffer = Buffer.from(await response.arrayBuffer());
	const normalized = await sharp(sourceBuffer).rotate().toBuffer();

	const mainBuffer = await sharp(normalized)
		.resize(500, 500, { fit: "cover", position: "entropy" })
		.webp({ quality: 85 })
		.toBuffer();
	const smallBuffer = await sharp(normalized)
		.resize(150, 150, { fit: "cover", position: "entropy" })
		.webp({ quality: 80 })
		.toBuffer();

	const profilePicture = `private/profile-pictures/${slug}.webp`;
	const profilePictureSmall = `public/profile-pictures/${slug}-thumb.webp`;

	await s3.send(
		new PutObjectCommand({
			Bucket: seedStorageConfig.bucket,
			Key: profilePicture,
			Body: mainBuffer,
			ContentType: "image/webp",
			CacheControl: "public, max-age=86400",
		}),
	);
	await s3.send(
		new PutObjectCommand({
			Bucket: seedStorageConfig.bucket,
			Key: profilePictureSmall,
			Body: smallBuffer,
			ContentType: "image/webp",
			CacheControl: "public, max-age=86400",
		}),
	);

	return { profilePicture, profilePictureSmall };
}

type CastMember = {
	email: string;
	name: string;
	familyName: string;
	role: "user" | "admin";
	/** null = leave unset so the checkout flow's FoodPreferenceStep prompts live. */
	foodPreference: string | null;
	/** null = leave unset so the checkout flow's PhotoConsentStep prompts live. */
	photoConsentGiven: boolean | null;
};

// Maya is the only cast member with food/photo left unset — she's the buyer in
// events-member-flow.spec.ts, and completing both live during checkout is the
// whole point of that recording. Everyone else is a "returning member" whose
// profile is already complete.
const CAST: CastMember[] = [
	{
		email: "priya.kapoor@example.com",
		name: "Priya",
		familyName: "Kapoor",
		role: "admin",
		foodPreference: "No restrictions",
		photoConsentGiven: true,
	},
	{
		email: "maya.chen@example.com",
		name: "Maya",
		familyName: "Chen",
		role: "user",
		foodPreference: null,
		photoConsentGiven: null,
	},
	{
		email: "jordan.alvarez@example.com",
		name: "Jordan",
		familyName: "Alvarez",
		role: "user",
		foodPreference: "Vegetarian",
		photoConsentGiven: true,
	},
	{
		email: "elena.ruiz@example.com",
		name: "Elena",
		familyName: "Ruiz",
		role: "user",
		foodPreference: "Vegan",
		photoConsentGiven: true,
	},
	{
		email: "marcus.webb@example.com",
		name: "Marcus",
		familyName: "Webb",
		role: "user",
		foodPreference: "No restrictions",
		photoConsentGiven: true,
	},
	{
		email: "sofia.novak@example.com",
		name: "Sofia",
		familyName: "Novak",
		role: "user",
		foodPreference: "Gluten-free",
		photoConsentGiven: false,
	},
	{
		email: "tariq.hassan@example.com",
		name: "Tariq",
		familyName: "Hassan",
		role: "user",
		foodPreference: "No restrictions",
		photoConsentGiven: true,
	},
	{
		email: "noah.bergman@example.com",
		name: "Noah",
		familyName: "Bergman",
		role: "user",
		foodPreference: "No restrictions",
		photoConsentGiven: true,
	},
];
// Elena, Marcus, Sofia, Tariq, and Noah are the background cast whose
// participation_status gets seeded against the demo event by
// events-member-flow.spec.ts once it exists (see BACKGROUND_ATTENDEE_EMAILS
// there — duplicated rather than imported so importing the spec doesn't
// re-run this script's top-level seeding side effects). The public event
// page's "who's going" tile only renders the avatar stack once count >= 5 —
// fewer than that falls back to an empty-state placeholder — hence 5 names,
// not 4.

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

for (const person of CAST) {
	const existingLogin = db
		.prepare("SELECT id FROM logins WHERE email = ?")
		.get(person.email) as { id: string } | undefined;

	if (existingLogin) {
		console.log(`  skip (already seeded): ${person.name} ${person.familyName}`);
		continue;
	}

	const loginId = uuid();
	db.prepare("INSERT INTO logins (id, email, expires_at) VALUES (?, ?, ?)").run(
		loginId,
		person.email,
		"2099-01-01T00:00:00.000Z",
	);

	const consent: Record<string, string> = {
		profile: now(),
		lastProfileUpdate: now(),
		locationVerification: now(),
	};
	if (person.foodPreference !== null) consent.foodPreference = now();
	if (person.photoConsentGiven !== null) consent.photoConsent = now();

	const slug = `${person.name}-${person.familyName}`
		.toLowerCase()
		.replace(/\s+/g, "-");
	const { profilePicture, profilePictureSmall } = await uploadProfilePhoto(
		person.email,
		slug,
		s3,
	);

	const userId = uuid();
	db.prepare(
		`INSERT INTO users
			(id, name, family_name, login_id, role, consent, food_preference, photo_consent_given, profile_picture, profile_picture_small, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		userId,
		person.name,
		person.familyName,
		loginId,
		person.role,
		JSON.stringify(consent),
		person.foodPreference,
		person.photoConsentGiven === null ? null : person.photoConsentGiven ? 1 : 0,
		profilePicture,
		profilePictureSmall,
		now(),
		now(),
	);

	console.log(
		`  created ${person.role} '${person.name} ${person.familyName}' (${person.email})`,
	);
}

console.log("Promo cast seed complete.");
db.close();

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

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";
import sharp from "sharp";
import { faker } from "@faker-js/faker";
import {
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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

// ─── 2. Push schema via drizzle-kit ──────────────────────────────────────────

console.log("Pushing schema with drizzle-kit...");
execSync("npx drizzle-kit push --config drizzle.config.ts", { stdio: "inherit" });

// ─── 3. Open DB connection ───────────────────────────────────────────────────

const sqlite = new Database(DB_PATH);
const db = drizzle({
  client: sqlite,
  schema,
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
    await s3.send(new CreateBucketCommand({ Bucket: seedStorageConfig.bucket }));
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

async function downloadAndUploadSeedImages(): Promise<string[]> {
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

  for (let i = 0; i < seedImageSources.length; i++) {
    const sourceUrl = seedImageSources[i];
    const baseKey = `${seedStorageConfig.imagePrefix}/seed-${i + 1}`;
    const objectKey = `${baseKey}.webp`;
    const smallObjectKey = `${baseKey}-thumb.webp`;

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download seed image: ${sourceUrl} (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const sourceBuffer = Buffer.from(arrayBuffer);
    const normalized = await sharp(sourceBuffer)
      .rotate()
      .toBuffer();

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

    uploadedKeys.push(objectKey);
  }

  return uploadedKeys;
}

// ─── 4. Base users ───────────────────────────────────────────────────────────

const ADMIN_EMAIL = "admin@example.com";

const existingUsers = db.select().from(schema.users).all();

let adminUser = existingUsers.find((u) => u.role === "admin" && u.name === "Admin");
let hostUser = existingUsers.find((u) => u.name === "Host");

if (!adminUser) {
  const loginId = uuid();
  db.insert(schema.logins)
    .values({ id: loginId, email: ADMIN_EMAIL, expiresAt: "2099-01-01T00:00:00.000Z" })
    .run();

  const id = uuid();
  db.insert(schema.users)
    .values({ id, name: "Admin", familyName: "User", role: "admin", loginId, createdAt: now(), updatedAt: now() })
    .run();
  adminUser = db.select().from(schema.users).all().find((u) => u.id === id)!;
  console.log(`  created admin user 'Admin' (${ADMIN_EMAIL})`);
}

if (!hostUser) {
  const loginId = uuid();
  db.insert(schema.logins)
    .values({ id: loginId, email: "host@example.com", expiresAt: "2099-01-01T00:00:00.000Z" })
    .run();
  const id = uuid();
  db.insert(schema.users)
    .values({ id, name: "Host", familyName: "User", role: "admin", loginId, createdAt: now(), updatedAt: now() })
    .run();
  hostUser = db.select().from(schema.users).all().find((u) => u.id === id)!;
  console.log("  created host user 'Host' (host@example.com)");
}

const TEST_USER_EMAILS = new Set(
  Array.from({ length: 10 }, (_, i) => `user${i + 1}@example.com`),
);
const testLoginIds = new Set(
  db.select().from(schema.logins).all()
    .filter((l) => TEST_USER_EMAILS.has(l.email))
    .map((l) => l.id),
);

let testUsers = db
  .select()
  .from(schema.users)
  .all()
  .filter((u) => u.role === "user" && testLoginIds.has(u.loginId ?? ""));

// Ensure existing test users have the consent fields needed to reach the survey phase.
for (const u of testUsers) {
  const consent = (u.consent ?? {}) as Record<string, string | null>;
  if (!consent.lastProfileUpdate || !consent.locationVerification) {
    db.update(schema.users)
      .set({ consent: { ...consent, lastProfileUpdate: now(), locationVerification: now() } })
      .where(eq(schema.users.id, u.id))
      .run();
  }
}

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
  console.log(`  ensured 10 test users exist (now ${testUsers.length})`);
}

console.log(
  `Users: admin=${adminUser.name}, host=${hostUser.name}, test=${testUsers.length}`,
);

// ─── 4b. Bulk fake users (1000 users with European locations) ────────────────

const BULK_USER_TARGET = 1000;

const knownSpecialEmails = new Set([
  ADMIN_EMAIL,
  "host@example.com",
]);

const allBulkUsers = db
  .select()
  .from(schema.users)
  .all()
  .filter(
    (u) =>
      u.role === "user" &&
      !testLoginIds.has(u.loginId ?? ""),
  );

// All users missing a city (includes admin, host, test, QA users)
const allUsersWithoutCity = db.select().from(schema.users).all().filter((u) => !u.city);
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
        role: "user",
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

const groupDefs = [
  { name: "North Chapter",   slug: "berlin",    latitude: "59.3293", longitude: "18.0686" }, // Stockholm
  { name: "South Chapter",   slug: "munich",    latitude: "41.3851", longitude: "2.1734"  }, // Barcelona
  { name: "Coast Chapter",   slug: "hamburg",   latitude: "51.5074", longitude: "-0.1278" }, // London
  { name: "Central Chapter", slug: "frankfurt", latitude: "48.2082", longitude: "16.3738" }, // Vienna
  { name: "West Chapter",    slug: "cologne",   latitude: "48.8566", longitude: "2.3522"  }, // Paris
];

const existingGroups = db.select().from(schema.groups).all();
const groupIds: Record<string, string> = {};

for (const def of groupDefs) {
  const existing = existingGroups.find((g) => g.slug === def.slug);
  if (existing) {
    groupIds[def.slug] = existing.id;
  } else {
    const id = uuid();
    db.insert(schema.groups)
      .values({ id, ...def, createdAt: now(), updatedAt: now() })
      .run();
    groupIds[def.slug] = id;
    console.log(`  created group '${def.name}'`);
  }
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

const existingMemberships = db.select().from(schema.groupMemberships).all();

for (const m of membershipPlan) {
  const already = existingMemberships.some(
    (em) => em.userId === m.userId && em.groupId === groupIds[m.groupSlug],
  );
  if (already) continue;
  db.insert(schema.groupMemberships)
    .values({ id: uuid(), userId: m.userId, groupId: groupIds[m.groupSlug], joinedAt: now() })
    .run();
}
console.log("  memberships seeded");

// Assign bulk faker users to groups (1–2 groups each, random)
{
  const assignedSet = new Set(
    db.select().from(schema.groupMemberships).all()
      .map((m) => `${m.userId}::${m.groupId}`),
  );
  const groupSlugList = Object.keys(groupIds);
  const bulkUserIds = db.select().from(schema.users).all()
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
      db.insert(schema.groupMemberships)
        .values({
          id: uuid(),
          userId,
          groupId,
          joinedAt: faker.date.between({ from: "2020-01-01", to: new Date() }).toISOString(),
        })
        .run();
      bulkMembershipCount++;
    }
  }
  console.log(`  bulk user memberships seeded (${bulkMembershipCount} across ${bulkUserIds.length} users)`);
}

// ─── 7. Representatives ──────────────────────────────────────────────────────
// Ensure every group has at least one rep. Pick one from the group's bulk members.
{
  const existingReps = db.select().from(schema.groupRepresentatives).all();
  const groupsWithRep = new Set(existingReps.map((r) => r.groupId));
  const allMemberships = db.select().from(schema.groupMemberships).all();

  for (const [, groupId] of Object.entries(groupIds)) {
    if (groupsWithRep.has(groupId)) continue;
    // Pick a random member who is not admin/host
    const candidates = allMemberships.filter(
      (m) => m.groupId === groupId && m.userId !== adminUser.id && m.userId !== hostUser.id,
    );
    if (candidates.length === 0) continue;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    db.insert(schema.groupRepresentatives)
      .values({
        id: uuid(),
        userId: pick.userId,
        groupId,
        promotedBy: adminUser.id,
        promotedAt: now(),
      })
      .run();
    groupsWithRep.add(groupId);
  }
  console.log("  representatives seeded");
}

// ─── 8. Posts ────────────────────────────────────────────────────────────────

const postDefs: Array<{
  title: string;
  body: string;
  groupSlug: string | null;
  visibility: "global" | "group-only";
  authorIdx: number;
}> = [
  {
    title: "Welcome to the North Chapter!",
    body: "<p>Hey everyone, great to have you here. This is the official group for all North Chapter members. Introduce yourself and say hello!</p>",
    groupSlug: "berlin",
    visibility: "global",
    authorIdx: 0,
  },
  {
    title: "Spring Meetup Recap",
    body: "<p>What a fantastic evening! We had over 30 people join us for our spring gathering. Thanks to everyone who came out — see you at the next one.</p>",
    groupSlug: "berlin",
    visibility: "group-only",
    authorIdx: 0,
  },
  {
    title: "New Members – Introduce Yourself!",
    body: "<p>We've had a wave of new sign-ups recently. Drop a reply below and tell the group a bit about yourself — where you're based, what you do, and what you're hoping to get from the community.</p>",
    groupSlug: "berlin",
    visibility: "group-only",
    authorIdx: 5,
  },
  {
    title: "South Chapter Is Here",
    body: "<p>Welcome to the South Chapter! We're just getting started but already have some exciting events in the pipeline. Watch this space.</p>",
    groupSlug: "munich",
    visibility: "global",
    authorIdx: 2,
  },
  {
    title: "Summer Networking Evening – Interested?",
    body: "<p>We're thinking of organising a casual networking evening this summer. Reply below if you'd be up for it and we'll lock in a date.</p>",
    groupSlug: "munich",
    visibility: "group-only",
    authorIdx: 7,
  },
  {
    title: "Coast Chapter – Now Open",
    body: "<p>The Coast Chapter is officially open. Whether you're a long-time member or just joined, you're welcome here. Looking forward to building something great together.</p>",
    groupSlug: "hamburg",
    visibility: "global",
    authorIdx: 6,
  },
  {
    title: "Morning Walk – Members Only",
    body: "<p>We're organising a guided walk along the waterfront on Saturday morning. Limited spots — reply to join. Details will be shared with confirmed attendees.</p>",
    groupSlug: "hamburg",
    visibility: "group-only",
    authorIdx: 3,
  },
  {
    title: "Central Chapter Launches",
    body: "<p>Central Chapter is now live! We're excited to build a local community here. If you're in the area, join the group and say hello.</p>",
    groupSlug: "frankfurt",
    visibility: "global",
    authorIdx: 4,
  },
  {
    title: "Networking Night – Save the Date",
    body: "<p>We're hosting a networking evening for members next month. More details to follow — mark your calendars and spread the word.</p>",
    groupSlug: "frankfurt",
    visibility: "group-only",
    authorIdx: 8,
  },
  {
    title: "West Chapter – Welcome",
    body: "<p>We're thrilled to open the West Chapter. A space for local members to connect, share, and organise events together.</p>",
    groupSlug: "cologne",
    visibility: "global",
    authorIdx: -2,
  },
  {
    title: "Members-Only Gathering – Limited Spots",
    body: "<p>We're organising a private members-only get-together. Spots are limited so reply early to secure yours. Location shared with confirmed attendees.</p>",
    groupSlug: "cologne",
    visibility: "group-only",
    authorIdx: 3,
  },
  {
    title: "New Features Live on the Platform",
    body: "<p>We've just rolled out a set of improvements including updated group pages, better event management, and a cleaner profile experience. Let us know what you think.</p>",
    groupSlug: null,
    visibility: "global",
    authorIdx: -1,
  },
  {
    title: "Community Guidelines — Updated",
    body: "<p>We've refreshed our community guidelines to keep things clear and respectful for everyone. Please take a moment to read through them.</p>",
    groupSlug: null,
    visibility: "global",
    authorIdx: -1,
  },
];

function resolveAuthor(idx: number) {
  if (idx === -1) return adminUser!.id;
  if (idx === -2) return hostUser!.id;
  return testUsers[idx]?.id ?? adminUser!.id;
}

postDefs.forEach((p, i) => {
  // Stagger createdAt by one minute per post so timestamps are strictly
  // distinct and descending. Cursor pagination keys on createdAt, so a batch
  // sharing the same millisecond would break page boundaries at the ties.
  const createdAt = new Date(Date.now() - i * 60_000).toISOString();
  db.insert(schema.posts)
    .values({
      id: uuid(),
      title: p.title,
      body: p.body,
      editorState: null,
      userId: resolveAuthor(p.authorIdx),
      groupId: p.groupSlug ? groupIds[p.groupSlug] : null,
      visibility: p.visibility,
      createdAt,
      updatedAt: createdAt,
    })
    .run();
});
console.log(`  posts seeded (${postDefs.length})`);

// Add faker-generated posts for each group (3 per group)
{
  const groupSlugsForPosts = Object.entries(groupIds); // [slug, id][]
  const allGroupPosts = db.select().from(schema.posts).all();
  const fakerPostTopics = [
    () => ({ title: faker.company.catchPhrase(), body: `<p>${faker.lorem.paragraph()}</p><p>${faker.lorem.paragraph()}</p>` }),
    () => ({ title: `Upcoming: ${faker.lorem.words(3)}`, body: `<p>${faker.lorem.paragraph()}</p><p>${faker.lorem.paragraph()}</p>` }),
    () => ({ title: `Member spotlight: ${faker.person.firstName()} ${faker.person.lastName()}`, body: `<p>${faker.lorem.paragraph()}</p><p>${faker.lorem.paragraph()}</p>` }),
    () => ({ title: `Community update — ${faker.date.month()}`, body: `<p>${faker.lorem.paragraph()}</p>` }),
    () => ({ title: faker.lorem.sentence({ min: 4, max: 7 }).replace(/\.$/, ""), body: `<p>${faker.lorem.paragraph()}</p><p>${faker.lorem.paragraph()}</p>` }),
  ];

  for (const [, groupId] of groupSlugsForPosts) {
    const existingCount = allGroupPosts.filter((p) => p.groupId === groupId).length;
    const toAdd = Math.max(0, 3 - existingCount);
    for (let i = 0; i < toAdd; i++) {
      const { title, body } = fakerPostTopics[i % fakerPostTopics.length]();
      const createdAt = faker.date.between({ from: "2023-01-01", to: new Date() }).toISOString();
      db.insert(schema.posts)
        .values({
          id: uuid(),
          title,
          body,
          editorState: null,
          userId: adminUser.id,
          groupId,
          visibility: "global",
          createdAt,
          updatedAt: createdAt,
        })
        .run();
    }
  }
  console.log(`  faker posts added per group`);
}

// ─── 9. Events ───────────────────────────────────────────────────────────────

const eventDefs: Array<{
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
    title: "Evening Social — Tickets Available",
    body: "<p>A relaxed evening gathering for all community members. Light refreshments included. A great opportunity to meet people and enjoy the community in a social setting.</p>",
    groupSlug: null,
    visibility: "global",
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
    visibility: "global",
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
    visibility: "group-only",
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
    visibility: "group-only",
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
    visibility: "global",
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
    visibility: "group-only",
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
    visibility: "group-only",
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
    visibility: "global",
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
    visibility: "group-only",
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
    visibility: "global",
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
    visibility: "group-only",
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
    visibility: "global",
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
    visibility: "global",
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
    visibility: "global",
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
    visibility: "global",
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
    visibility: "global",
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
  const end = new Date(new Date(start).getTime() + e.durationHours * 3600000).toISOString();

  db.insert(schema.events)
    .values({
      id: uuid(),
      title: e.title,
      body: e.body,
      startDate: start,
      endDate: end,
      locationType: e.city === "Online" ? "online" : "in-person",
      address: e.address || null,
      city: e.city,
      country: e.country,
      longitude: e.longitude,
      latitude: e.latitude,
      onlineUrl: e.city === "Online" ? "https://meet.example.com/town-hall" : null,
      userId: resolveAuthor(e.authorIdx),
      groupId: e.groupSlug ? groupIds[e.groupSlug] : null,
      visibility: e.visibility,
      createdAt: now(),
      updatedAt: now(),
    })
    .run();
}
console.log(`  events seeded (${eventDefs.length})`);

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
  const evt = db.select().from(schema.events).all().find((e) => e.title === eventTitle);
  if (!evt) continue;

  // Each event gets a random subset of users with varied statuses
  const usersForEvent = [...testUsers, adminUser!, hostUser!];
  for (let i = 0; i < usersForEvent.length; i++) {
    // Skip some users randomly to create realistic variation
    if (Math.random() < 0.3) continue;
    const existing = db
      .select()
      .from(schema.participationStatus)
      .all()
      .find(
        (p) =>
          p.userId === usersForEvent[i].id && p.eventId === evt.id,
      );
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

  const invId = uuid();
  db.insert(schema.inventoryGroups)
    .values({
      id: invId,
      eventId: e.id,
      name: opts.inventoryName,
      maxCapacity: opts.maxCapacity,
      needsTicket: opts.needsTicket ?? true,
      salesStartDate: typeof opts.salesStartOffset === "number" ? daysFromNow(opts.salesStartOffset) : null,
      salesEndDate: typeof opts.salesEndOffset === "number" ? daysFromNow(opts.salesEndOffset) : null,
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
  eventTitle: "Evening Social — Tickets Available",
  inventoryName: "Social Evening Tickets",
  maxCapacity: 80,
  salesStartOffset: -14,
  salesEndOffset: 4,
  products: [
    { name: "General Admission", price: 15, maxQuantity: 60, soldQuantity: 14 },
    { name: "VIP Entry (incl. welcome drink)", price: 30, maxQuantity: 20, soldQuantity: 5 },
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
    { name: "VIP Seat (front row + networking)", price: 15, maxQuantity: 5, soldQuantity: 2 },
  ],
});

seedInventory({
  eventTitle: "New Members Welcome Night",
  inventoryName: "Welcome Night Spots",
  maxCapacity: 20,
  salesStartOffset: -3,
  salesEndOffset: 6,
  products: [
    { name: "Welcome Night Ticket", price: 0, maxQuantity: 20, soldQuantity: 4 },
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
    { name: "Breakfast Ticket (incl. food)", price: 12, maxQuantity: 20, soldQuantity: 5 },
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
    { name: "Pitcher Ticket (present your startup)", price: 0, maxQuantity: 5, soldQuantity: 3 },
  ],
});

seedInventory({
  eventTitle: "West Chapter Members Dinner",
  inventoryName: "Dinner Tickets",
  maxCapacity: 20,
  salesStartOffset: -1,
  salesEndOffset: 8,
  products: [
    { name: "Dinner Ticket (3-course meal)", price: 25, maxQuantity: 20, soldQuantity: 8 },
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
    { name: "Standard Pass",   price: 79, maxQuantity: 200, soldQuantity: 0 },
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
    { name: "AI Hands-on Workshop", price: 22, maxQuantity: 30, soldQuantity: 4 },
    { name: "Founder Coaching Session", price: 45, maxQuantity: 20, soldQuantity: 3 },
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
  const bulkUsers = db.select().from(schema.users).all()
    .filter((u) => u.id !== adminUser.id && u.id !== hostUser.id && !testLoginIds.has(u.loginId ?? ""));
  const bulkUserPool = bulkUsers.map((u) => u.id);
  const bulkUserById = new Map(bulkUsers.map((u) => [u.id, u]));
  const loginEmailById = new Map(
    db.select().from(schema.logins).all().map((l) => [l.id, l.email]),
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
    products: Array<{ name: string; price: number; capacity: number; attendees: number }>;
  }) {
    if (db.select().from(schema.events).all().find((e) => e.title === opts.title)) return;

    const eventId = uuid();
    const endDate = new Date(new Date(opts.startDate).getTime() + opts.durationHours * 3_600_000).toISOString();
    const createdAt = new Date(new Date(opts.startDate).getTime() - 30 * 86_400_000).toISOString();

    db.insert(schema.events).values({
      id: eventId, title: opts.title, body: opts.body,
      startDate: opts.startDate, endDate,
      locationType: opts.locationType === "online" ? "online" : "in-person",
      address: opts.address || null, city: opts.city, country: opts.country,
      longitude: opts.longitude, latitude: opts.latitude,
      onlineUrl: opts.onlineUrl ?? null,
      userId: adminUser!.id,
      groupId: opts.groupSlug ? groupIds[opts.groupSlug] : null,
      visibility: "global", createdAt, updatedAt: createdAt,
    }).run();

    const invId = uuid();
    db.insert(schema.inventoryGroups).values({
      id: invId, eventId, name: "Tickets",
      maxCapacity: opts.products.reduce((s, p) => s + p.capacity, 0),
      needsTicket: true,
      salesStartDate: new Date(new Date(opts.startDate).getTime() - 60 * 86_400_000).toISOString(),
      salesEndDate:   new Date(new Date(opts.startDate).getTime() -      86_400_000).toISOString(),
      createdAt,
    }).run();

    for (const product of opts.products) {
      const productId = uuid();
      db.insert(schema.products).values({
        id: productId, eventId, inventoryGroupId: invId,
        name: product.name, price: product.price,
        maxQuantity: product.capacity, soldQuantity: product.attendees,
        participantCapacity: 1, features: [], imageKey: null, stripeProductId: null,
        createdAt, updatedAt: createdAt,
      }).run();

      for (const buyerId of pickBuyers(product.attendees)) {
        const buyer = bulkUserById.get(buyerId)!;
        const buyerEmail = buyer.loginId ? loginEmailById.get(buyer.loginId) ?? null : null;
        const purchaseDate = new Date(
          new Date(opts.startDate).getTime() - Math.random() * 25 * 86_400_000,
        ).toISOString();
        const txId = uuid();
        db.insert(schema.transactions).values({
          id: txId, eventId, userId: buyerId,
          totalAmount: product.price,
          transactionFee: product.price > 0 ? Math.round(product.price * 0.029 * 100) / 100 : 0,
          stripeSessionId: `cs_hist_${uuid().slice(0, 8)}`,
          stripePaymentId: product.price > 0 ? `pi_hist_${uuid().slice(0, 8)}` : null,
          paymentDate: purchaseDate, createdAt: purchaseDate,
        }).run();
        db.insert(schema.transactionItems).values({
          id: uuid(), transactionId: txId, productId, quantity: 1, unitPrice: product.price,
        }).run();
        const ticketId = uuid();
        db.insert(schema.tickets).values({
          id: ticketId, qrCodeUuid: uuid(), transactionId: txId,
          productId, eventId, buyerId,
          scannedAt: new Date(new Date(opts.startDate).getTime() + Math.random() * 3_600_000).toISOString(),
          createdAt: purchaseDate,
        }).run();
        db.insert(schema.ticketParticipants).values({
          id: uuid(),
          ticketId,
          participantOrder: 1,
          name: `${buyer.name} ${(buyer as any).familyName ?? ""}`.trim(),
          email: buyerEmail ?? `${buyer.name.toLowerCase()}@example.com`,
          userId: buyerId,
        }).run();
      }
    }
  }

  const p = (text: string) => `<p>${text}</p>`;

  // ── Global events ─────────────────────────────────────────────────────────
  seedHistoricalEvent({ title: "Community Founding Meetup", body: p(faker.lorem.paragraph()), groupSlug: null, startDate: "2015-06-12T18:00:00.000Z", durationHours: 3, city: "Demo City", country: "Exampleland", address: "The Foundry, Demo City", latitude: "52.5200", longitude: "13.4050", locationType: "in-person", products: [{ name: "Free Entry", price: 0, capacity: 60, attendees: 42 }] });
  seedHistoricalEvent({ title: "Annual Gathering 2016", body: p(faker.lorem.paragraph()), groupSlug: null, startDate: "2016-10-08T10:00:00.000Z", durationHours: 8, city: "Demo City", country: "Exampleland", address: "Grand Hall, Demo City", latitude: "52.5200", longitude: "13.4050", locationType: "in-person", products: [{ name: "Standard Ticket", price: 15, capacity: 80, attendees: 68 }, { name: "VIP Ticket", price: 35, capacity: 20, attendees: 14 }] });
  seedHistoricalEvent({ title: "Summer Social 2017", body: p(faker.lorem.paragraph()), groupSlug: null, startDate: "2017-07-14T17:00:00.000Z", durationHours: 4, city: "Demo City", country: "Exampleland", address: "Riverside Park, Demo City", latitude: "52.5200", longitude: "13.4050", locationType: "in-person", products: [{ name: "Free Entry", price: 0, capacity: 80, attendees: 63 }] });
  seedHistoricalEvent({ title: "Annual Conference 2018", body: p(faker.lorem.paragraph()), groupSlug: null, startDate: "2018-09-21T09:00:00.000Z", durationHours: 9, city: "Demo City", country: "Exampleland", address: "Convention Centre, Demo City", latitude: "52.5200", longitude: "13.4050", locationType: "in-person", products: [{ name: "Day Pass", price: 20, capacity: 120, attendees: 98 }, { name: "VIP Pass", price: 45, capacity: 30, attendees: 22 }] });
  seedHistoricalEvent({ title: "Annual Conference 2019", body: p(faker.lorem.paragraph()), groupSlug: null, startDate: "2019-10-05T09:00:00.000Z", durationHours: 10, city: "Southville", country: "Exampleland", address: "Expo Centre, Southville", latitude: "41.3851", longitude: "2.1734", locationType: "in-person", products: [{ name: "Standard Pass", price: 25, capacity: 160, attendees: 143 }, { name: "Premium Pass", price: 55, capacity: 40, attendees: 31 }] });
  seedHistoricalEvent({ title: "Online Town Hall — Spring 2020", body: p("Our first fully online event, bringing all chapters together virtually."), groupSlug: null, startDate: "2020-05-20T17:00:00.000Z", durationHours: 2, city: "Online", country: "Exampleland", address: "", latitude: "52.5200", longitude: "13.4050", locationType: "online", onlineUrl: "https://meet.example.com/townhall-2020", products: [{ name: "Free Entry", price: 0, capacity: 200, attendees: 147 }] });
  seedHistoricalEvent({ title: "Online Workshop — Autumn 2020", body: p(faker.lorem.paragraph()), groupSlug: null, startDate: "2020-11-14T10:00:00.000Z", durationHours: 3, city: "Online", country: "Exampleland", address: "", latitude: "52.5200", longitude: "13.4050", locationType: "online", onlineUrl: "https://meet.example.com/workshop-2020", products: [{ name: "Free Entry", price: 0, capacity: 150, attendees: 89 }] });
  seedHistoricalEvent({ title: "First In-Person Since 2020", body: p("A long-awaited return to meeting face-to-face. " + faker.lorem.sentence()), groupSlug: null, startDate: "2021-07-03T15:00:00.000Z", durationHours: 4, city: "Demo City", country: "Exampleland", address: "Rooftop Bar, Demo City", latitude: "52.5200", longitude: "13.4050", locationType: "in-person", products: [{ name: "Free Entry", price: 0, capacity: 80, attendees: 71 }] });
  seedHistoricalEvent({ title: "Annual Conference 2022", body: p(faker.lorem.paragraph()), groupSlug: null, startDate: "2022-06-17T09:00:00.000Z", durationHours: 10, city: "Portstown", country: "Exampleland", address: "Harbour Convention Centre, Portstown", latitude: "51.5074", longitude: "-0.1278", locationType: "in-person", products: [{ name: "Standard Pass", price: 30, capacity: 200, attendees: 176 }, { name: "VIP Pass", price: 60, capacity: 50, attendees: 38 }] });
  seedHistoricalEvent({ title: "Summer Social 2023", body: p(faker.lorem.paragraph()), groupSlug: null, startDate: "2023-07-22T16:00:00.000Z", durationHours: 5, city: "Demo City", country: "Exampleland", address: "Rooftop Terrace, Demo City", latitude: "52.5200", longitude: "13.4050", locationType: "in-person", products: [{ name: "Free Entry", price: 0, capacity: 100, attendees: 83 }] });
  seedHistoricalEvent({ title: "Annual Conference 2024", body: p(faker.lorem.paragraph()), groupSlug: null, startDate: "2024-04-19T09:00:00.000Z", durationHours: 10, city: "Midtown", country: "Exampleland", address: "Innovation Hub, Midtown", latitude: "48.2082", longitude: "16.3738", locationType: "in-person", products: [{ name: "Standard Pass", price: 35, capacity: 250, attendees: 214 }, { name: "VIP Pass", price: 70, capacity: 50, attendees: 41 }] });

  // ── Local chapter events ──────────────────────────────────────────────────
  seedHistoricalEvent({ title: "North Chapter — Spring Social 2016", body: p(faker.lorem.paragraph()), groupSlug: "berlin", startDate: "2016-04-09T14:00:00.000Z", durationHours: 3, city: "Demo City", country: "Exampleland", address: "Local Café, Demo City", latitude: "59.3293", longitude: "18.0686", locationType: "in-person", products: [{ name: "Free Entry", price: 0, capacity: 30, attendees: 23 }] });
  seedHistoricalEvent({ title: "South Chapter — Hiking Day 2018", body: p(faker.lorem.paragraph()), groupSlug: "munich", startDate: "2018-05-19T09:00:00.000Z", durationHours: 5, city: "Southville", country: "Exampleland", address: "Trailhead, Southville", latitude: "41.3851", longitude: "2.1734", locationType: "in-person", products: [{ name: "Free Entry", price: 0, capacity: 25, attendees: 19 }] });
  seedHistoricalEvent({ title: "Coast Chapter — Harbour Walk 2019", body: p(faker.lorem.paragraph()), groupSlug: "hamburg", startDate: "2019-09-07T10:00:00.000Z", durationHours: 2, city: "Portstown", country: "Exampleland", address: "Harbourside, Portstown", latitude: "51.5074", longitude: "-0.1278", locationType: "in-person", products: [{ name: "Free Entry", price: 0, capacity: 20, attendees: 17 }] });
  seedHistoricalEvent({ title: "Central Chapter — Networking Dinner 2021", body: p(faker.lorem.paragraph()), groupSlug: "frankfurt", startDate: "2021-10-14T19:00:00.000Z", durationHours: 3, city: "Midtown", country: "Exampleland", address: "The Grand Café, Midtown", latitude: "48.2082", longitude: "16.3738", locationType: "in-person", products: [{ name: "Dinner Ticket", price: 18, capacity: 40, attendees: 32 }] });
  seedHistoricalEvent({ title: "West Chapter — End of Year Party 2022", body: p(faker.lorem.paragraph()), groupSlug: "cologne", startDate: "2022-12-02T19:00:00.000Z", durationHours: 4, city: "Westford", country: "Exampleland", address: "Town Square Venue, Westford", latitude: "48.8566", longitude: "2.3522", locationType: "in-person", products: [{ name: "Entry Ticket", price: 10, capacity: 50, attendees: 41 }] });
  seedHistoricalEvent({ title: "North Chapter — Annual Dinner 2023", body: p(faker.lorem.paragraph()), groupSlug: "berlin", startDate: "2023-11-18T19:00:00.000Z", durationHours: 3, city: "Demo City", country: "Exampleland", address: "The Riverside Restaurant, Demo City", latitude: "59.3293", longitude: "18.0686", locationType: "in-person", products: [{ name: "Dinner Ticket", price: 22, capacity: 45, attendees: 38 }] });
  seedHistoricalEvent({ title: "South Chapter — Workshop Day 2024", body: p(faker.lorem.paragraph()), groupSlug: "munich", startDate: "2024-02-24T10:00:00.000Z", durationHours: 6, city: "Southville", country: "Exampleland", address: "Community Centre, Southville", latitude: "41.3851", longitude: "2.1734", locationType: "in-person", products: [{ name: "Workshop Ticket", price: 12, capacity: 30, attendees: 27 }] });

  const pastCount = db.select().from(schema.events).all().filter((e) => new Date(e.startDate) < new Date()).length;
  console.log(`  historical events seeded (${pastCount} total past events with participants)`);
}

// ─── 12. Placeholder images ──────────────────────────────────────────────────

const imageKeys = await downloadAndUploadSeedImages();

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

const eventsNoImg = sqlite
  .prepare("SELECT id FROM events WHERE deleted_at IS NULL AND (image1 IS NULL OR image1 LIKE '%picsum.photos%' OR image2 IS NULL OR image2 LIKE '%picsum.photos%')")
  .all() as Array<{ id: string }>;
const updateEvent = sqlite.prepare("UPDATE events SET image1 = ?, image2 = ? WHERE id = ?");
for (let i = 0; i < eventsNoImg.length; i++) {
  updateEvent.run(
    imageKeys[i % imageKeys.length],
    imageKeys[(i + 1) % imageKeys.length],
    eventsNoImg[i].id,
  );
}

const postsNoImg = sqlite
  .prepare("SELECT id FROM posts WHERE deleted_at IS NULL AND (featured_image IS NULL OR featured_image LIKE '%picsum.photos%')")
  .all() as Array<{ id: string }>;
const updatePost = sqlite.prepare("UPDATE posts SET featured_image = ? WHERE id = ?");
for (let i = 0; i < postsNoImg.length; i++) {
  updatePost.run(imageKeys[i % imageKeys.length], postsNoImg[i].id);
}

const groupsNoImg = sqlite
  .prepare("SELECT id FROM groups WHERE (image1 IS NULL OR image1 LIKE '%picsum.photos%' OR image2 IS NULL OR image2 LIKE '%picsum.photos%' OR image3 IS NULL OR image3 LIKE '%picsum.photos%')")
  .all() as Array<{ id: string }>;
const updateGroup = sqlite.prepare("UPDATE groups SET image1 = ?, image2 = ?, image3 = ? WHERE id = ?");
for (let i = 0; i < groupsNoImg.length; i++) {
  updateGroup.run(
    imageKeys[i % imageKeys.length],
    imageKeys[(i + 1) % imageKeys.length],
    imageKeys[(i + 2) % imageKeys.length],
    groupsNoImg[i].id,
  );
}

console.log(`  images downloaded/uploaded and linked (${eventsNoImg.length} events, ${postsNoImg.length} posts, ${groupsNoImg.length} groups)`);
console.log(`  user profile pictures assigned (${usersWithoutProfile.length} users)`);

// ─── 13. Forms ───────────────────────────────────────────────────────────────

const onboardJson = JSON.parse(fs.readFileSync("surveys/onboard.json", "utf-8"));

const formDefs: Array<{
  title: string;
  slug: string;
  description: string;
  schemaJson: any;
  visibility: "private" | "public";
  isSystemForm: boolean;
  allowResubmission?: boolean;
  systemKey: string | null;
}> = [
  {
    title: "Onboarding Survey",
    slug: "onboarding",
    description: "Required during signup — captures how you know us and your academic background.",
    schemaJson: onboardJson,
    visibility: "private",
    isSystemForm: true,
    allowResubmission: true,
    systemKey: "affilation",
  },
  {
    title: "Community Feedback",
    slug: "community-feedback",
    description: "Tell us what you think about the community and how we can improve.",
    schemaJson: {
      pages: [{
        name: "feedback_page",
        elements: [
          { type: "rating", name: "overall_rating", title: "How would you rate your overall experience?", rateMin: 1, rateMax: 5, minRateDescription: "Poor", maxRateDescription: "Excellent", isRequired: true },
          { type: "radiogroup", name: "how_often", title: "How often do you attend events?", choices: ["Weekly", "Monthly", "A few times a year", "This was my first time"], isRequired: true },
          { type: "comment", name: "what_we_do_well", title: "What do we do well?" },
          { type: "comment", name: "what_to_improve", title: "What could we improve?" },
          { type: "boolean", name: "recommend", title: "Would you recommend us to a friend?", isRequired: true },
        ],
      }],
    },
    visibility: "public",
    isSystemForm: false,
    systemKey: null,
  },
];

for (const f of formDefs) {
  const existing = f.systemKey
    ? db.select().from(schema.forms).all().find((r) => r.systemKey === f.systemKey)
    : null;

  if (existing) {
    if (f.allowResubmission !== undefined && existing.allowResubmission !== f.allowResubmission) {
      db.update(schema.forms)
        .set({ allowResubmission: f.allowResubmission, updatedAt: now() })
        .where(eq(schema.forms.id, existing.id))
        .run();
    }
    continue;
  }

  db.insert(schema.forms)
    .values({
      id: uuid(),
      title: f.title,
      slug: f.slug,
      description: f.description,
      schemaJson: f.schemaJson,
      visibility: f.visibility,
      scopeType: "global",
      isSystemForm: f.isSystemForm,
      allowResubmission: f.allowResubmission ?? false,
      systemKey: f.systemKey,
      createdBy: adminUser.id,
      createdAt: now(),
      updatedAt: now(),
    })
    .run();
}
console.log(`  forms seeded (${formDefs.length})`);

// ─── 13b. Onboarding form results ─────────────────────────────────────────────

const onboardingForm = db
  .select()
  .from(schema.forms)
  .all()
  .find((f) => f.systemKey === "affilation");

if (onboardingForm) {
  // Delete any existing form results for test users so they land on the survey fresh.
  const testUserIdsForCleanup = new Set(
    db.select().from(schema.users).all()
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
    { status: "graduate",        faculty: "engineering",     programme_engineering: "software_engineering",  degree_level: "master",   graduation_year: 2022, how_did_you_hear: "classmate" },
    { status: "graduate",        faculty: "science",         programme_science: "computer_science",          degree_level: "master",   graduation_year: 2021, how_did_you_hear: "social_media" },
    { status: "graduate",        faculty: "social_sciences", programme_social: "economics",                  degree_level: "bachelor", graduation_year: 2023, how_did_you_hear: "professor" },
    { status: "graduate",        faculty: "engineering",     programme_engineering: "electrical_engineering", degree_level: "bachelor", graduation_year: 2020, how_did_you_hear: "uni_email" },
    { status: "graduate",        faculty: "arts",            programme_arts: "media_studies",                degree_level: "bachelor", graduation_year: 2019, how_did_you_hear: "event" },
    { status: "graduate",        faculty: "medicine",        programme_medicine: "medicine",                 degree_level: "master",   graduation_year: 2024, how_did_you_hear: "classmate" },
    { status: "graduate",        faculty: "science",         programme_science: "data_science",              degree_level: "master",   graduation_year: 2023, how_did_you_hear: "social_media" },
    { status: "graduate",        faculty: "law",             programme_law: "law",                           degree_level: "master",   graduation_year: 2022, how_did_you_hear: "professor" },
    { status: "graduate",        faculty: "social_sciences", programme_social: "psychology",                 degree_level: "bachelor", graduation_year: 2021, how_did_you_hear: "event" },
    { status: "graduate",        faculty: "engineering",     programme_engineering: "civil_engineering",     degree_level: "bachelor", graduation_year: 2018, how_did_you_hear: "uni_email" },
    { status: "graduate",        faculty: "architecture",    programme_architecture: "architecture",         degree_level: "master",   graduation_year: 2020, how_did_you_hear: "classmate" },
    { status: "graduate",        faculty: "science",         programme_science: "mathematics",               degree_level: "phd",      graduation_year: 2024, how_did_you_hear: "professor" },
    { status: "current_student", faculty: "engineering",     programme_engineering: "software_engineering",  degree_level: "bachelor", current_year: "year_3", how_did_you_hear: "classmate" },
    { status: "current_student", faculty: "social_sciences", programme_social: "business_admin",            degree_level: "master",   current_year: "year_1", how_did_you_hear: "social_media" },
    { status: "current_student", faculty: "science",         programme_science: "computer_science",          degree_level: "bachelor", current_year: "year_2", how_did_you_hear: "uni_email" },
    { status: "current_student", faculty: "arts",            programme_arts: "history",                      degree_level: "bachelor", current_year: "year_3", how_did_you_hear: "professor" },
    { status: "current_student", faculty: "medicine",        programme_medicine: "nursing",                  degree_level: "bachelor", current_year: "year_4", how_did_you_hear: "event" },
    { status: "current_student", faculty: "engineering",     programme_engineering: "mechanical_engineering", degree_level: "master",  current_year: "postgrad_year", how_did_you_hear: "classmate" },
    { status: "staff",           faculty: "science",         how_did_you_hear: "other" },
    { status: "graduate",        faculty: "social_sciences", programme_social: "political_science",          degree_level: "master",   graduation_year: 2019, how_did_you_hear: "other" },
  ];

  // Re-query all users now that all bulk users have been inserted
  // Exclude test users so they land on the survey fresh each time.
  const testUserIds = new Set(
    db.select().from(schema.users).all()
      .filter((u) => testLoginIds.has(u.loginId ?? ""))
      .map((u) => u.id),
  );
  const usersToSeed = db.select().from(schema.users).all();
  let formResultsInserted = 0;

  for (const user of usersToSeed) {
    if (alreadySubmitted.has(user.id)) continue;
    if (testUserIds.has(user.id)) continue;

    const resultJson = affiliationPool[Math.floor(Math.random() * affiliationPool.length)];

    db.insert(schema.formResults)
      .values({
        id: uuid(),
        formId: onboardingForm.id,
        userId: user.id,
        resultJson,
        submittedAt: now(),
      })
      .run();

    formResultsInserted++;
  }

  console.log(`  onboarding form results seeded (${formResultsInserted} inserted)`);
}

// ─── 14. Pages ───────────────────────────────────────────────────────────────

const DEFAULT_TILES = JSON.stringify([
  { type: "stat", area: "left-top", number: "2000+", title: "Members", description: "A fast growing community that inspires and connects." },
  { type: "image", area: "left-bottom", image: "https://picsum.photos/400/400" },
  { type: "image", area: "middle", image: "https://picsum.photos/500/700", overlayText: "With multiple events all over Europe every year we help to grow your network and make memories." },
  { type: "image", area: "right-top", image: "https://picsum.photos/400/500" },
  { type: "stat", area: "right-bottom", number: "10+", title: "Local communities", description: "Can't find your city yet? Start your own one." },
], null, 2);

const pageDefs: Array<{ title: string; slug: string; status: "published" | "draft"; content: any[] }> = [
  {
    title: "Home",
    slug: "/",
    status: "published",
    content: [
      { id: uuid(), componentType: "HeroSectionBlock", order: 0, data: {} },
      { id: uuid(), componentType: "SpacerBlock", order: 1, data: { height: 40 } },
      { id: uuid(), componentType: "TitleBlock", order: 2, data: { text: "Upcoming Events", level: "2", align: "center" } },
      { id: uuid(), componentType: "UpcomingEventsBlock", order: 3, data: {} },
      { id: uuid(), componentType: "SpacerBlock", order: 4, data: { height: 40 } },
      { id: uuid(), componentType: "TitleBlock", order: 5, data: { text: "Our Communities", level: "2", align: "center" } },
      { id: uuid(), componentType: "GroupsListBlock", order: 6, data: {} },
      { id: uuid(), componentType: "SpacerBlock", order: 7, data: { height: 40 } },
      { id: uuid(), componentType: "TitleBlock", order: 8, data: { text: "Latest Posts", level: "2", align: "center" } },
      { id: uuid(), componentType: "PostsListBlock", order: 9, data: { limit: 6 } },
    ],
  },
  {
    title: "About",
    slug: "/about",
    status: "published",
    content: [
      { id: uuid(), componentType: "TitleBlock", order: 0, data: { text: "About This Community", level: "1", align: "center" } },
      { id: uuid(), componentType: "SpacerBlock", order: 1, data: { height: 20 } },
      { id: uuid(), componentType: "TextBlock", order: 2, data: { content: "<p>We started as a small group of people who wanted to build a space to connect beyond the usual networking events. What began as a single local chapter quickly grew into a network of communities across different cities.</p><p>Today, we are a growing community with members spread across multiple chapters. Our mission is simple: bring people together, foster genuine relationships, and create opportunities for personal and professional growth.</p>" } },
      { id: uuid(), componentType: "SpacerBlock", order: 3, data: { height: 40 } },
      { id: uuid(), componentType: "TitleBlock", order: 4, data: { text: "Our Values", level: "2", align: "left" } },
      { id: uuid(), componentType: "TextBlock", order: 5, data: { content: "<p><strong>Openness</strong> — Everyone is welcome, regardless of background or experience.</p><p><strong>Authenticity</strong> — We value real connections over superficial networking.</p><p><strong>Local Roots</strong> — Each chapter is shaped by its members and the place it calls home.</p>" } },
      { id: uuid(), componentType: "SpacerBlock", order: 6, data: { height: 40 } },
      { id: uuid(), componentType: "QuoteBlock", order: 7, data: { quote: "Great communities are built on trust, not transactions.", attribution: "Community Team" } },
    ],
  },
  {
    title: "Block Gallery",
    slug: "/block-gallery",
    status: "published",
    content: [
      { id: uuid(), componentType: "TitleBlock", order: 0, data: { text: "Block Gallery", level: "1", align: "center" } },
      { id: uuid(), componentType: "TextBlock", order: 1, data: { content: "<p>This page showcases all available content blocks. Open the page builder in the admin to add, remove, and configure them on any page.</p>" } },
      { id: uuid(), componentType: "SpacerBlock", order: 2, data: { height: 40 } },

      { id: uuid(), componentType: "TitleBlock", order: 3, data: { text: "Callout", level: "2", align: "left" } },
      { id: uuid(), componentType: "CalloutBlock", order: 4, data: { type: "info", title: "Info callout", body: "Use this for helpful tips, notes, or supplementary information." } },
      { id: uuid(), componentType: "CalloutBlock", order: 5, data: { type: "tip", title: "Tip callout", body: "Great for pro tips or recommended actions." } },
      { id: uuid(), componentType: "CalloutBlock", order: 6, data: { type: "warning", title: "Warning callout", body: "Draws attention to something the reader should be careful about." } },
      { id: uuid(), componentType: "CalloutBlock", order: 7, data: { type: "danger", title: "Danger callout", body: "Reserved for critical alerts or irreversible actions." } },
      { id: uuid(), componentType: "SpacerBlock", order: 8, data: { height: 40 } },

      { id: uuid(), componentType: "TitleBlock", order: 9, data: { text: "Quote", level: "2", align: "left" } },
      { id: uuid(), componentType: "QuoteBlock", order: 10, data: { quote: "The strength of the community is each individual member. The strength of each member is the community.", attribution: "Phil Jackson", role: "Coach" } },
      { id: uuid(), componentType: "SpacerBlock", order: 11, data: { height: 40 } },

      { id: uuid(), componentType: "TitleBlock", order: 12, data: { text: "Accordion", level: "2", align: "left" } },
      { id: uuid(), componentType: "AccordionBlock", order: 13, data: { heading: "Frequently Asked Questions", items: JSON.stringify([
        { question: "How do I join a chapter?", answer: "Browse the Communities page and click 'View Group' on any chapter. From there you can join with a single click." },
        { question: "Can I create my own chapter?", answer: "Yes — contact an admin to request a new chapter for your city or region." },
        { question: "How do I post an event?", answer: "Events are created from the admin panel. Navigate to Admin → Events → New Event." },
        { question: "Is membership free?", answer: "Basic membership is always free. Some events may have a ticket price set by the organiser." },
      ]) } },
      { id: uuid(), componentType: "SpacerBlock", order: 14, data: { height: 40 } },

      { id: uuid(), componentType: "TitleBlock", order: 15, data: { text: "Video", level: "2", align: "left" } },
      { id: uuid(), componentType: "TextBlock", order: 16, data: { content: "<p>Paste any YouTube, Vimeo, or direct <code>.mp4</code> URL into the Video block config to embed it.</p>" } },
      { id: uuid(), componentType: "VideoBlock", order: 17, data: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", caption: "Example: a YouTube video embedded with the Video block." } },
      { id: uuid(), componentType: "SpacerBlock", order: 18, data: { height: 40 } },

      { id: uuid(), componentType: "TitleBlock", order: 19, data: { text: "Action Button", level: "2", align: "left" } },
      { id: uuid(), componentType: "ActionButtonBlock", order: 20, data: { text: "Go to Admin Panel", href: "/admin/global", align: "left" } },
      { id: uuid(), componentType: "SpacerBlock", order: 21, data: { height: 40 } },

      { id: uuid(), componentType: "TitleBlock", order: 22, data: { text: "Dynamic Blocks", level: "2", align: "left" } },
      { id: uuid(), componentType: "CalloutBlock", order: 23, data: { type: "info", title: "Self-fetching blocks", body: "The blocks below (Upcoming Events, Groups List, Posts List) fetch their own data from the database. Drop them on any page and they update automatically." } },
      { id: uuid(), componentType: "SpacerBlock", order: 24, data: { height: 20 } },
      { id: uuid(), componentType: "TitleBlock", order: 25, data: { text: "Upcoming Events", level: "3", align: "left" } },
      { id: uuid(), componentType: "UpcomingEventsBlock", order: 26, data: {} },
    ],
  },
  {
    title: "Events",
    slug: "/events",
    status: "published",
    content: [
      { id: uuid(), componentType: "TitleBlock", order: 0, data: { text: "Events", level: "1", align: "center" } },
      { id: uuid(), componentType: "SpacerBlock", order: 1, data: { height: 20 } },
      { id: uuid(), componentType: "UpcomingEventsBlock", order: 2, data: {} },
      { id: uuid(), componentType: "SpacerBlock", order: 3, data: { height: 40 } },
      { id: uuid(), componentType: "TitleBlock", order: 4, data: { text: "Past Events", level: "2", align: "center" } },
      { id: uuid(), componentType: "PastEventsBlock", order: 5, data: {} },
    ],
  },
  {
    title: "Communities",
    slug: "/communities",
    status: "published",
    content: [
      { id: uuid(), componentType: "TitleBlock", order: 0, data: { text: "Our Communities", level: "1", align: "center" } },
      { id: uuid(), componentType: "SpacerBlock", order: 1, data: { height: 20 } },
      { id: uuid(), componentType: "TextBlock", order: 2, data: { content: "<p>Find your local community and connect with members in your area.</p>" } },
      { id: uuid(), componentType: "SpacerBlock", order: 3, data: { height: 40 } },
      { id: uuid(), componentType: "GroupsListBlock", order: 4, data: {} },
    ],
  },
  {
    title: "Deals",
    slug: "/deals",
    status: "published",
    content: [
      { id: uuid(), componentType: "TitleBlock", order: 0, data: { text: "Member Deals", level: "1", align: "center" } },
      { id: uuid(), componentType: "SpacerBlock", order: 1, data: { height: 20 } },
      { id: uuid(), componentType: "TextBlock", order: 2, data: { content: "<p>Exclusive discounts and offers for community members.</p>" } },
      { id: uuid(), componentType: "SpacerBlock", order: 3, data: { height: 20 } },
      { id: uuid(), componentType: "DealsListBlock", order: 4, data: {} },
    ],
  },
  {
    title: "News",
    slug: "/news",
    status: "published",
    content: [
      { id: uuid(), componentType: "TitleBlock", order: 0, data: { text: "News", level: "1", align: "center" } },
      { id: uuid(), componentType: "SpacerBlock", order: 1, data: { height: 20 } },
      { id: uuid(), componentType: "PostsListBlock", order: 2, data: { limit: 10 } },
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

// Pages that have a builder-managed content page are linked via pageId.
// Footer-only items (Contact, Privacy, Terms) are plain links with no page.
const menuDefs: Array<{ title: string; url: string; position: number; menuName: string; hasPage?: boolean }> = [
  { menuName: "main", title: "Home",          url: "/",              position: 0, hasPage: true },
  { menuName: "main", title: "Events",        url: "/events",        position: 1, hasPage: true },
  { menuName: "main", title: "Communities",   url: "/communities",   position: 2, hasPage: true },
  { menuName: "main", title: "News",          url: "/news",          position: 3, hasPage: true },
  { menuName: "main", title: "Jobs",          url: "/jobs",          position: 4 },
  { menuName: "main", title: "About",         url: "/about",         position: 5, hasPage: true },
  { menuName: "footer", title: "Home",        url: "/",              position: 0, hasPage: true },
  { menuName: "footer", title: "Events",      url: "/events",        position: 1, hasPage: true },
  { menuName: "footer", title: "Communities", url: "/communities",   position: 2, hasPage: true },
  { menuName: "footer", title: "News",        url: "/news",          position: 3, hasPage: true },
  { menuName: "footer", title: "Deals",       url: "/deals",         position: 4, hasPage: true },
  { menuName: "footer", title: "Jobs",        url: "/jobs",          position: 5 },
  { menuName: "footer", title: "About",       url: "/about",         position: 6, hasPage: true },
  { menuName: "footer", title: "Block Gallery", url: "/block-gallery", position: 7, hasPage: true },
];

for (const m of menuDefs) {
  db.insert(schema.menuItems)
    .values({
      id: uuid(),
      menuName: m.menuName,
      title: m.title,
      url: m.url,
      pageId: m.hasPage ? (pageIdByUrl.get(m.url) ?? null) : null,
      position: m.position,
      status: "visible",
      target: "_self",
      createdAt: now(),
      updatedAt: now(),
    })
    .run();
}
console.log(`  menu items seeded (${menuDefs.length})`);

// ─── 16. Deals ───────────────────────────────────────────────────────────────

const dealS3 = new S3Client({
  region: seedStorageConfig.region,
  endpoint: seedStorageConfig.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: seedStorageConfig.accessKeyId,
    secretAccessKey: seedStorageConfig.secretAccessKey,
  },
});

async function uploadDealLogo(slug: string, bgColor: string, letter: string): Promise<string | null> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="${bgColor}"/>
  <text x="100" y="115" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="96" font-weight="700" fill="white">${letter}</text>
</svg>`;
  const key = `public/deals/logos/seed-${slug}.svg`;
  try {
    await dealS3.send(new PutObjectCommand({
      Bucket: seedStorageConfig.bucket,
      Key: key,
      Body: Buffer.from(svg, "utf8"),
      ContentType: "image/svg+xml",
      CacheControl: "public, max-age=86400",
    }));
    return key;
  } catch {
    console.warn(`  could not upload deal logo for ${slug}, skipping`);
    return null;
  }
}

const dealDefs: Array<{
  slug: string;
  logoColor: string;
  logoLetter: string;
  name: string;
  description: string;
  validUntilOffsetDays: number | null;
  steps: schema.DealStep[];
}> = [
  {
    slug: "cafe",
    logoColor: "#0d9488",
    logoLetter: "C",
    name: "10% Off at Partner Café",
    description: "Enjoy an exclusive 10% discount at our partner café chain.",
    validUntilOffsetDays: 90,
    steps: [
      {
        type: "text",
        title: "Who qualifies",
        text: "Available to all active community members.",
        requiresLogin: false,
      },
      {
        type: "link",
        title: "Find a Location",
        text: "Browse all café locations near you.",
        link: "https://example.com/cafe-locations",
        linkText: "Browse Locations",
        requiresLogin: false,
      },
      {
        type: "promo",
        title: "Your Promo Code",
        text: "Use this code at checkout or show it in-store.",
        promoCode: "COMMUNITY10",
        requiresLogin: true,
      },
    ],
  },
  {
    slug: "gym",
    logoColor: "#ea580c",
    logoLetter: "G",
    name: "Free Month at FitSpace Gym",
    description: "Get your first month completely free at any FitSpace gym location.",
    validUntilOffsetDays: 60,
    steps: [
      {
        type: "text",
        title: "How it works",
        text: "Show your membership confirmation email at the front desk when signing up.",
        requiresLogin: false,
      },
      {
        type: "link",
        title: "Sign Up Online",
        text: "Start your free trial directly on the FitSpace website.",
        link: "https://example.com/fitspace-signup",
        linkText: "Start Free Trial",
        requiresLogin: true,
      },
      {
        type: "promo",
        title: "Referral Code",
        text: "Enter this code during online sign-up to activate the free month.",
        promoCode: "FITFREE2026",
        requiresLogin: true,
      },
    ],
  },
  {
    slug: "cowork",
    logoColor: "#7c3aed",
    logoLetter: "W",
    name: "20% Off Co-Working Day Pass",
    description: "Work from one of our co-working partner spaces at a special member rate.",
    validUntilOffsetDays: null,
    steps: [
      {
        type: "text",
        title: "Valid Locations",
        text: "Valid at all SpaceHub co-working partner locations. Find a location near you on their website.",
        requiresLogin: false,
      },
      {
        type: "promo",
        title: "Day Pass Code",
        text: "Present this code at reception or enter it when booking online.",
        promoCode: "SPACE20",
        requiresLogin: true,
      },
    ],
  },
  {
    slug: "expired",
    logoColor: "#6b7280",
    logoLetter: "X",
    name: "Expired Deal (Seed)",
    description: "This deal has already expired — used to test expiry filtering.",
    validUntilOffsetDays: -10,
    steps: [
      {
        type: "text",
        title: "Expired",
        text: "This deal is no longer active.",
        requiresLogin: false,
      },
    ],
  },
];

for (const d of dealDefs) {
  const logoKey = await uploadDealLogo(d.slug, d.logoColor, d.logoLetter);
  const validUntil =
    d.validUntilOffsetDays !== null ? daysFromNow(d.validUntilOffsetDays) : null;
  db.insert(schema.deals)
    .values({
      id: uuid(),
      name: d.name,
      description: d.description,
      logo: logoKey,
      validUntil,
      steps: d.steps,
      createdAt: now(),
      updatedAt: now(),
    })
    .run();
}
console.log(`  deals seeded (${dealDefs.length})`);

// ─── 17. Jobs ───────────────────────────────────────────────────────────────

const jobDefs: Array<{
  title: string;
  body: string;
  locationType: "on-site" | "remote-eu" | "remote-country";
  city?: string;
  country?: string;
  link?: string;
  posterRelation?: "hiring" | "founder" | "direct-team" | "works-there" | "other";
  expiresAtOffsetDays: number;
  status: "pending" | "approved";
  authorIdx: number;
}> = [
  {
    title: "Senior Full-Stack Engineer",
    body: `<h2>About the role</h2><p>We are looking for a Senior Full-Stack Engineer to join our product team. You will own features end-to-end — from database design through to the user interface.</p><h2>What you'll do</h2><ul><li>Design and build scalable backend APIs with Node.js</li><li>Develop responsive frontend components in React or similar</li><li>Collaborate with product and design in a small, fast-moving team</li></ul><h2>What we're looking for</h2><ul><li>5+ years of professional software development experience</li><li>Solid TypeScript and SQL skills</li><li>Strong communication and ownership mindset</li></ul>`,
    locationType: "on-site",
    city: "Demo City",
    country: "Exampleland",
    link: "https://example.com/jobs/senior-fullstack",
    posterRelation: "hiring",
    expiresAtOffsetDays: 25,
    status: "approved",
    authorIdx: 0,
  },
  {
    title: "Product Designer (Remote, EU)",
    body: `<h2>The opportunity</h2><p>We're hiring a Product Designer to help shape the future of our platform. You'll work closely with engineering and product to craft clear, useful, and beautiful interfaces.</p><h2>Responsibilities</h2><ul><li>Own the design process from discovery through delivery</li><li>Conduct user research and usability testing</li><li>Maintain and evolve our design system</li></ul><h2>Requirements</h2><ul><li>3+ years of product design experience</li><li>Proficiency with Figma</li><li>Experience in an agile environment</li></ul>`,
    locationType: "remote-eu",
    link: "https://example.com/jobs/product-designer",
    posterRelation: "hiring",
    expiresAtOffsetDays: 20,
    status: "approved",
    authorIdx: 2,
  },
  {
    title: "Data Analyst — Remote",
    body: `<h2>What you'll be doing</h2><p>Join our analytics team and help us turn data into decisions. You'll build dashboards, run analyses, and work with stakeholders across the business.</p><h2>Skills & experience</h2><ul><li>Strong SQL and Python skills</li><li>Experience with BI tools such as Metabase or Looker</li><li>Comfortable presenting findings to non-technical audiences</li></ul>`,
    locationType: "remote-country",
    country: "Exampleland",
    posterRelation: "works-there",
    expiresAtOffsetDays: 18,
    status: "approved",
    authorIdx: 4,
  },
  {
    title: "Community Manager",
    body: `<h2>About this role</h2><p>We are growing our local presence and are looking for a Community Manager to cultivate and grow the member base. You'll organise events, onboard new members, and be the face of the community.</p><h2>What we need</h2><ul><li>Excellent interpersonal and organisational skills</li><li>Experience planning and running events</li><li>Strong communication skills</li></ul>`,
    locationType: "on-site",
    city: "Southville",
    country: "Exampleland",
    posterRelation: "founder",
    expiresAtOffsetDays: 28,
    status: "approved",
    authorIdx: 7,
  },
  {
    title: "Backend Engineer — Pending Review",
    body: `<h2>The role</h2><p>We are hiring a Backend Engineer to work on our core platform API.</p><h2>Requirements</h2><ul><li>3+ years backend experience (Go, Node.js, or Python)</li><li>Experience with REST and/or GraphQL APIs</li><li>Familiarity with cloud infrastructure (AWS, GCP)</li></ul>`,
    locationType: "on-site",
    city: "Midtown",
    country: "Exampleland",
    link: "https://example.com/jobs/backend-engineer",
    posterRelation: "hiring",
    expiresAtOffsetDays: 30,
    status: "pending",
    authorIdx: 1,
  },
  {
    title: "Marketing Lead — Pending Review",
    body: `<h2>Overview</h2><p>We are looking for a Marketing Lead to own our growth channels and brand strategy.</p><h2>What you'll do</h2><ul><li>Define and execute the marketing roadmap</li><li>Manage social media, email, and paid channels</li><li>Measure and report on campaign performance</li></ul>`,
    locationType: "remote-eu",
    posterRelation: "direct-team",
    expiresAtOffsetDays: 14,
    status: "pending",
    authorIdx: 3,
  },
  {
    title: "Expired Role (Seed)",
    body: "<p>This job listing has already expired and should not appear in the public job board.</p>",
    locationType: "on-site",
    city: "Portstown",
    country: "Exampleland",
    expiresAtOffsetDays: -5,
    status: "approved",
    authorIdx: 6,
  },
];

for (const j of jobDefs) {
  db.insert(schema.jobs)
    .values({
      id: uuid(),
      title: j.title,
      body: j.body,
      editorState: null,
      locationType: j.locationType,
      city: j.city ?? null,
      country: j.country ?? null,
      link: j.link ?? null,
      posterRelation: j.posterRelation ?? null,
      expiresAt: daysFromNow(j.expiresAtOffsetDays),
      status: j.status,
      suggestedBy: resolveAuthor(j.authorIdx),
      createdAt: now(),
      updatedAt: now(),
    })
    .run();
}
console.log(`  jobs seeded (${jobDefs.length}: ${jobDefs.filter((j) => j.status === "approved").length} approved, ${jobDefs.filter((j) => j.status === "pending").length} pending, 1 expired)`);

// ─── 17b. Tag definitions ─────────────────────────────────────────────────────

const tagDefDefs: Array<{ slug: string; label: string; category: "board" | "qualification" | "participation" | "custom"; description: string }> = [
  // Board
  { slug: "board-member",    label: "Board Member",    category: "board",          description: "Serves on the organisation's board." },
  { slug: "board-president", label: "President",       category: "board",          description: "President of the board." },
  { slug: "board-secretary", label: "Secretary",       category: "board",          description: "Secretary of the board." },
  { slug: "board-treasurer", label: "Treasurer",       category: "board",          description: "Treasurer of the board." },
  // Participation
  { slug: "event-speaker",   label: "Event Speaker",   category: "participation",  description: "Has spoken at one of our events." },
  { slug: "event-volunteer", label: "Event Volunteer", category: "participation",  description: "Has volunteered at one of our events." },
  { slug: "program-graduate", label: "Program Graduate", category: "participation", description: "Completed one of our programs." },
  // Custom
  { slug: "mentor",          label: "Mentor",          category: "custom",         description: "Active mentor in the community." },
  { slug: "ambassador",      label: "Ambassador",      category: "custom",         description: "Community ambassador in their city or region." },
  { slug: "chapter-lead",    label: "Chapter Lead",    category: "custom",         description: "Leads a local chapter." },
  { slug: "founding-member", label: "Founding Member", category: "custom",         description: "Was part of the community from the very beginning." },
];

for (const def of tagDefDefs) {
  const exists = db.select().from(schema.tagDefinitions).all().find((d) => d.slug === def.slug);
  if (!exists) {
    db.insert(schema.tagDefinitions)
      .values({ id: uuid(), slug: def.slug, label: def.label, category: def.category, description: def.description, createdAt: now(), updatedAt: now() })
      .run();
  }
}
console.log(`  tag definitions seeded (${tagDefDefs.length})`);

// ─── 18. Qualification types ─────────────────────────────────────────────────

const qualTypeDefs = [
  { slug: "master-school", label: "Master School Graduate", description: "Completed our master-level programme.", grantsMembershipTier: "full" as const },
  { slug: "summer-school", label: "Summer School Graduate", description: "Completed our summer school programme.", grantsMembershipTier: "associated" as const },
  { slug: "phd", label: "PhD", description: "Holds a doctoral degree.", grantsMembershipTier: "full" as const },
  { slug: "former-employee", label: "Former Employee", description: "Previously worked at the organisation.", grantsMembershipTier: "associated" as const },
];

const existingQualTypes = db.select().from(schema.qualificationTypes).all();
const qualTypeIdBySlug: Record<string, string> = {};

for (const qt of qualTypeDefs) {
  const existing = existingQualTypes.find((q) => q.slug === qt.slug);
  if (existing) {
    qualTypeIdBySlug[qt.slug] = existing.id;
  } else {
    const id = uuid();
    db.insert(schema.qualificationTypes)
      .values({ id, slug: qt.slug, label: qt.label, description: qt.description, grantsMembershipTier: qt.grantsMembershipTier, createdAt: now(), updatedAt: now() })
      .run();
    qualTypeIdBySlug[qt.slug] = id;
    console.log(`  created qualification type '${qt.slug}'`);
  }
}
console.log(`  qualification types seeded (${qualTypeDefs.length})`);

// ─── 19. User qualifications, memberships & tags ──────────────────────────────

// Maps: userIdx (-1=admin) → { typeSlug, status, notes? }
const qualificationPlan: Array<{
  userIdx: number;
  typeSlug: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
}> = [
  { userIdx: 0, typeSlug: "master-school", status: "approved" },
  { userIdx: 1, typeSlug: "summer-school", status: "approved" },
  { userIdx: 2, typeSlug: "phd", status: "approved" },
  { userIdx: 3, typeSlug: "summer-school", status: "pending" },
  { userIdx: 4, typeSlug: "phd", status: "pending" },
  { userIdx: 5, typeSlug: "master-school", status: "rejected", notes: "Could not verify the transcript submitted." },
  { userIdx: 6, typeSlug: "former-employee", status: "approved" },
  { userIdx: 7, typeSlug: "summer-school", status: "approved" },
  { userIdx: -1, typeSlug: "master-school", status: "approved" },
];

const existingQuals = db.select().from(schema.userQualifications).all();
const existingMembershipRows = db.select().from(schema.userMemberships).all();
const existingTagRows = db.select().from(schema.userTags).all();

// Tier hierarchy for upgrade-only logic
const tierRank: Record<string, number> = { associated: 1, full: 2 };

for (const plan of qualificationPlan) {
  const userId = plan.userIdx === -1 ? adminUser!.id : testUsers[plan.userIdx]?.id;
  if (!userId) continue;
  const typeId = qualTypeIdBySlug[plan.typeSlug];
  if (!typeId) continue;

  // Upsert qualification
  const exists = existingQuals.find((q) => q.userId === userId && q.typeId === typeId);
  let qualId: string;
  if (!exists) {
    qualId = uuid();
    db.insert(schema.userQualifications)
      .values({
        id: qualId,
        userId,
        typeId,
        status: plan.status,
        notes: plan.notes ?? null,
        verifiedBy: plan.status !== "pending" ? adminUser!.id : null,
        verifiedAt: plan.status !== "pending" ? now() : null,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
  } else {
    qualId = exists.id;
  }

  if (plan.status !== "approved") continue;

  // For approved qualifications: grant membership and tag
  const qualType = qualTypeDefs.find((qt) => qt.slug === plan.typeSlug)!;
  const grantsTier = qualType.grantsMembershipTier;

  // Membership — only upgrade, never downgrade
  const existingMembership = existingMembershipRows.find((m) => m.userId === userId)
    ?? db.select().from(schema.userMemberships).all().find((m) => m.userId === userId);
  const currentRank = existingMembership ? (tierRank[existingMembership.tier] ?? 0) : 0;
  const newRank = tierRank[grantsTier] ?? 0;

  if (newRank > currentRank) {
    if (existingMembership) {
      db.update(schema.userMemberships)
        .set({ tier: grantsTier, grantedBy: adminUser!.id, grantedAt: now(), updatedAt: now() })
        .where(eq(schema.userMemberships.userId, userId))
        .run();
    } else {
      db.insert(schema.userMemberships)
        .values({ id: uuid(), userId, tier: grantsTier, grantedBy: adminUser!.id, grantedAt: now(), createdAt: now(), updatedAt: now() })
        .run();
    }
    // Refresh for subsequent iterations
    existingMembershipRows.push({ id: "", userId, tier: grantsTier, grantedBy: adminUser!.id, grantedAt: now(), expiresAt: null, notes: null, createdAt: now(), updatedAt: now() });
  }

  // Tag — upsert on (userId, slug)
  const tagExists = existingTagRows.find((t) => t.userId === userId && t.slug === plan.typeSlug)
    ?? db.select().from(schema.userTags).all().find((t) => t.userId === userId && t.slug === plan.typeSlug);
  if (!tagExists) {
    db.insert(schema.userTags)
      .values({ id: uuid(), userId, slug: plan.typeSlug, label: qualType.label, category: "qualification", sourceType: "qualification", sourceId: qualId, grantedBy: adminUser!.id, grantedAt: now() })
      .run();
  }
}

const qualCount = db.select().from(schema.userQualifications).all().length;
const membershipCount = db.select().from(schema.userMemberships).all().length;
const tagCount = db.select().from(schema.userTags).all().length;
console.log(`  user qualifications seeded (${qualCount})`);
console.log(`  user memberships seeded (${membershipCount})`);
console.log(`  user tags seeded (${tagCount})`);

// ─── Done ────────────────────────────────────────────────────────────────────

const counts = {
  users: db.select().from(schema.users).all().length,
  groups: db.select().from(schema.groups).all().length,
  memberships: db.select().from(schema.groupMemberships).all().length,
  reps: db.select().from(schema.groupRepresentatives).all().length,
  posts: db.select().from(schema.posts).all().length,
  events: db.select().from(schema.events).all().length,
  inventoryGroups: db.select().from(schema.inventoryGroups).all().length,
  products: db.select().from(schema.products).all().length,
  participationStatus: db.select().from(schema.participationStatus).all().length,
  pages: db.select().from(schema.pages).all().length,
  menuItems: db.select().from(schema.menuItems).all().length,
  forms: db.select().from(schema.forms).all().length,
  deals: db.select().from(schema.deals).all().length,
  jobs: db.select().from(schema.jobs).all().length,
  qualificationTypes: db.select().from(schema.qualificationTypes).all().length,
  userQualifications: db.select().from(schema.userQualifications).all().length,
  userMemberships: db.select().from(schema.userMemberships).all().length,
  userTags: db.select().from(schema.userTags).all().length,
};

console.log("\n✅ Seed complete:");
for (const [k, v] of Object.entries(counts)) {
  console.log(`   ${k}: ${v}`);
}

sqlite.close();

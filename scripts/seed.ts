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

let adminUser = existingUsers.find((u) => u.role === "admin" && u.name === "Konrad");
let hostUser = existingUsers.find((u) => u.name === "Host");

if (!adminUser) {
  const loginId = uuid();
  db.insert(schema.logins)
    .values({ id: loginId, email: ADMIN_EMAIL, expiresAt: "2099-01-01T00:00:00.000Z" })
    .run();

  const id = uuid();
  db.insert(schema.users)
    .values({ id, name: "Konrad", familyName: "Admin", role: "admin", loginId, createdAt: now(), updatedAt: now() })
    .run();
  adminUser = db.select().from(schema.users).all().find((u) => u.id === id)!;
  console.log(`  created admin user 'Konrad' (${ADMIN_EMAIL})`);
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

let testUsers = db
  .select()
  .from(schema.users)
  .all()
  .filter((u) => u.role === "user" && u.familyName === "Test");

const qaCheckoutUserDefs = [
  { name: "Marta", familyName: "Keller", email: "qa.marta@example.com" },
  { name: "Jonas", familyName: "Richter", email: "qa.jonas@example.com" },
  { name: "Leonie", familyName: "Baumann", email: "qa.leonie@example.com" },
  { name: "Tariq", familyName: "Hassan", email: "qa.tariq@example.com" },
] as const;

const qaCheckoutUsers: Array<typeof schema.users.$inferSelect> = [];

for (const qaUser of qaCheckoutUserDefs) {
  const existingLogin = db
    .select()
    .from(schema.logins)
    .all()
    .find((login) => login.email === qaUser.email);

  if (!existingLogin) {
    const loginId = uuid();
    db.insert(schema.logins)
      .values({ id: loginId, email: qaUser.email, expiresAt: "2099-01-01T00:00:00.000Z" })
      .run();

    db.insert(schema.users)
      .values({
        id: uuid(),
        name: qaUser.name,
        familyName: qaUser.familyName,
        role: "user",
        loginId,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
    continue;
  }

  const existingUser = db
    .select()
    .from(schema.users)
    .all()
    .find((user) => user.loginId === existingLogin.id);

  if (!existingUser) {
    db.insert(schema.users)
      .values({
        id: uuid(),
        name: qaUser.name,
        familyName: qaUser.familyName,
        role: "user",
        loginId: existingLogin.id,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
  }
}

for (const qaUser of qaCheckoutUserDefs) {
  const login = db
    .select()
    .from(schema.logins)
    .all()
    .find((l) => l.email === qaUser.email);
  if (!login) continue;
  const user = db
    .select()
    .from(schema.users)
    .all()
    .find((u) => u.loginId === login.id);
  if (user) {
    qaCheckoutUsers.push(user);
  }
}

if (testUsers.length < 10) {
  for (let i = testUsers.length; i < 10; i++) {
    const loginId = uuid();
    const email = `user${i + 1}@example.com`;
    db.insert(schema.logins)
      .values({ id: loginId, email, expiresAt: "2099-01-01T00:00:00.000Z" })
      .run();
    db.insert(schema.users)
      .values({ id: uuid(), name: `User${i + 1}`, familyName: "Test", role: "user", loginId, createdAt: now(), updatedAt: now() })
      .run();
  }
  testUsers = db
    .select()
    .from(schema.users)
    .all()
    .filter((u) => u.role === "user" && u.familyName === "Test");
  console.log(`  ensured 10 test users exist (now ${testUsers.length})`);
}

console.log(
  `Users: admin=${adminUser.name}, host=${hostUser.name}, test=${testUsers.length}`,
);
console.log(`  checkout QA users ensured (${qaCheckoutUsers.length})`);

// ─── 4b. Bulk fake users (1000 users with European locations) ────────────────

const BULK_USER_TARGET = 1000;

const knownSpecialEmails = new Set([
  ADMIN_EMAIL,
  "host@example.com",
  ...qaCheckoutUserDefs.map((q) => q.email),
]);

const allBulkUsers = db
  .select()
  .from(schema.users)
  .all()
  .filter(
    (u) =>
      u.role === "user" &&
      u.familyName !== "Test" &&
      !qaCheckoutUserDefs.some(
        (q) => q.name === u.name && q.familyName === u.familyName,
      ),
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
  { name: "Berlin", slug: "berlin", latitude: "52.5200", longitude: "13.4050" },
  { name: "Munich", slug: "munich", latitude: "48.1351", longitude: "11.5820" },
  { name: "Hamburg", slug: "hamburg", latitude: "53.5511", longitude: "9.9937" },
  { name: "Frankfurt", slug: "frankfurt", latitude: "50.1109", longitude: "8.6821" },
  { name: "Cologne", slug: "cologne", latitude: "50.9333", longitude: "6.9500" },
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

// ─── 7. Representatives ──────────────────────────────────────────────────────

const repPlan: Array<{ userId: string; groupSlug: string }> = [
  { userId: testUsers[0]?.id, groupSlug: "munich" },
  { userId: testUsers[2]?.id, groupSlug: "munich" },
  { userId: testUsers[6]?.id, groupSlug: "hamburg" },
  { userId: testUsers[4]?.id, groupSlug: "frankfurt" },
  { userId: testUsers[8]?.id, groupSlug: "cologne" },
  { userId: hostUser.id, groupSlug: "hamburg" },
].filter((r) => r.userId);

const existingReps = db.select().from(schema.groupRepresentatives).all();

for (const r of repPlan) {
  const already = existingReps.some(
    (er) => er.userId === r.userId && er.groupId === groupIds[r.groupSlug],
  );
  if (already) continue;
  db.insert(schema.groupRepresentatives)
    .values({
      id: uuid(),
      userId: r.userId,
      groupId: groupIds[r.groupSlug],
      promotedBy: adminUser.id,
      promotedAt: now(),
    })
    .run();
}
console.log("  representatives seeded");

// ─── 8. Posts ────────────────────────────────────────────────────────────────

const postDefs: Array<{
  title: string;
  body: string;
  groupSlug: string | null;
  visibility: "global" | "group-only";
  authorIdx: number;
}> = [
  {
    title: "Welcome to the Berlin Group!",
    body: "<p>Hey everyone, great to have you here. This is the official group for all Berlin-based members.</p>",
    groupSlug: "berlin",
    visibility: "global",
    authorIdx: 0,
  },
  {
    title: "Berlin Meetup Recap – Spring Edition",
    body: "<p>What a fantastic evening! We had over 30 people join us at the Kulturbrauerei.</p>",
    groupSlug: "berlin",
    visibility: "group-only",
    authorIdx: 0,
  },
  {
    title: "New Members – Introduce Yourself!",
    body: "<p>We've had a wave of new sign-ups recently. Drop a comment below and tell the group a bit about yourself.</p>",
    groupSlug: "berlin",
    visibility: "group-only",
    authorIdx: 5,
  },
  {
    title: "Munich Group – First Update",
    body: "<p>Welcome to Munich! We're just getting started here but we already have some exciting events planned.</p>",
    groupSlug: "munich",
    visibility: "global",
    authorIdx: 2,
  },
  {
    title: "Oktoberfest Community Meetup Planning",
    body: "<p>We're planning a group outing around Oktoberfest season. Reply if you're interested!</p>",
    groupSlug: "munich",
    visibility: "group-only",
    authorIdx: 7,
  },
  {
    title: "Hamburg Is Live!",
    body: "<p>The Hamburg group is now officially open. Whether you're a local or just visiting, you're welcome here.</p>",
    groupSlug: "hamburg",
    visibility: "global",
    authorIdx: 6,
  },
  {
    title: "Harbour Walk – Members Only Event",
    body: "<p>We're organising a guided walk along the harbour on Saturday morning. Details in Events.</p>",
    groupSlug: "hamburg",
    visibility: "group-only",
    authorIdx: 3,
  },
  {
    title: "Frankfurt Group Launch",
    body: "<p>Frankfurt is now on the map! We're excited to build a community here.</p>",
    groupSlug: "frankfurt",
    visibility: "global",
    authorIdx: 4,
  },
  {
    title: "Finance & Tech Networking Night",
    body: "<p>We're hosting a networking evening for members in finance and tech. Bring your business cards!</p>",
    groupSlug: "frankfurt",
    visibility: "group-only",
    authorIdx: 8,
  },
  {
    title: "Cologne Group – Welcome Post",
    body: "<p>We're thrilled to open the Cologne group. A space for everyone in the Cologne area.</p>",
    groupSlug: "cologne",
    visibility: "global",
    authorIdx: -2,
  },
  {
    title: "Carnival Pre-Party – Members Only",
    body: "<p>Cologne Carnival is around the corner! We're organising a private pre-party. Limited spots.</p>",
    groupSlug: "cologne",
    visibility: "group-only",
    authorIdx: 3,
  },
  {
    title: "Platform Announcement: New Features Live",
    body: "<p>We've just rolled out new features including improved group pages, better event management, and a refreshed profile page.</p>",
    groupSlug: null,
    visibility: "global",
    authorIdx: -1,
  },
  {
    title: "Community Guidelines Update",
    body: "<p>Please review our updated community guidelines. We've added clearer rules around respectful communication.</p>",
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

for (const p of postDefs) {
  db.insert(schema.posts)
    .values({
      id: uuid(),
      title: p.title,
      body: p.body,
      editorState: null,
      userId: resolveAuthor(p.authorIdx),
      groupId: p.groupSlug ? groupIds[p.groupSlug] : null,
      visibility: p.visibility,
      createdAt: now(),
      updatedAt: now(),
    })
    .run();
}
console.log(`  posts seeded (${postDefs.length})`);

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
    title: "Berlin Summer Social",
    body: "<p>Join us for our annual summer social in Görlitzer Park. Free, informal gathering for all Berlin members.</p>",
    groupSlug: "berlin",
    visibility: "global",
    authorIdx: 0,
    startOffsetDays: 14,
    durationHours: 4,
    city: "Berlin",
    country: "Germany",
    address: "Görlitzer Park, Wiener Str. 59, 10999 Berlin",
    latitude: "52.4988",
    longitude: "13.4439",
  },
  {
    title: "Berlin Tech Talk: AI in 2025",
    body: "<p>A members-only evening of short talks on the latest in AI and machine learning.</p>",
    groupSlug: "berlin",
    visibility: "group-only",
    authorIdx: 5,
    startOffsetDays: 21,
    durationHours: 3,
    city: "Berlin",
    country: "Germany",
    address: "Factory Berlin, Rheinsberger Str. 76/77, 10115 Berlin",
    latitude: "52.5369",
    longitude: "13.4008",
  },
  {
    title: "Berlin New Members Welcome Night",
    body: "<p>Just joined? Come along to our relaxed welcome night at a local bar.</p>",
    groupSlug: "berlin",
    visibility: "group-only",
    authorIdx: -2,
    startOffsetDays: 7,
    durationHours: 2,
    city: "Berlin",
    country: "Germany",
    address: "Prater Garten, Kastanienallee 7-9, 10435 Berlin",
    latitude: "52.5396",
    longitude: "13.4119",
  },
  {
    title: "Munich Community Hike – Englischer Garten",
    body: "<p>Let's explore the Englischer Garten together! All fitness levels welcome.</p>",
    groupSlug: "munich",
    visibility: "global",
    authorIdx: 2,
    startOffsetDays: 10,
    durationHours: 3,
    city: "Munich",
    country: "Germany",
    address: "Chinesischer Turm, Englischer Garten, 80538 Munich",
    latitude: "48.1545",
    longitude: "11.5956",
  },
  {
    title: "Munich Members Workshop: Public Speaking",
    body: "<p>A practical workshop on public speaking for members. Space is limited to 15 people.</p>",
    groupSlug: "munich",
    visibility: "group-only",
    authorIdx: 7,
    startOffsetDays: 30,
    durationHours: 2,
    city: "Munich",
    country: "Germany",
    address: "Impact Hub Munich, Gotzinger Str. 8, 81371 Munich",
    latitude: "48.1247",
    longitude: "11.5456",
  },
  {
    title: "Hamburg Harbour Morning Walk",
    body: "<p>Start your Saturday right with a 90-minute guided walk along the Hamburg harbour.</p>",
    groupSlug: "hamburg",
    visibility: "group-only",
    authorIdx: 6,
    startOffsetDays: 6,
    durationHours: 2,
    city: "Hamburg",
    country: "Germany",
    address: "Landungsbrücken, St. Pauli, 20359 Hamburg",
    latitude: "53.5446",
    longitude: "9.9685",
  },
  {
    title: "Hamburg Open Meetup",
    body: "<p>An open-door meetup for everyone in Hamburg. No agenda, just great people.</p>",
    groupSlug: "hamburg",
    visibility: "global",
    authorIdx: 3,
    startOffsetDays: 18,
    durationHours: 3,
    city: "Hamburg",
    country: "Germany",
    address: "Alsterpark, Am Alsterufer, 20354 Hamburg",
    latitude: "53.5668",
    longitude: "9.9961",
  },
  {
    title: "Frankfurt Networking Breakfast",
    body: "<p>An early morning networking session over coffee and pastries. Frankfurt members only.</p>",
    groupSlug: "frankfurt",
    visibility: "group-only",
    authorIdx: 4,
    startOffsetDays: 12,
    durationHours: 2,
    city: "Frankfurt",
    country: "Germany",
    address: "MainTor, Neue Mainzer Str. 6-10, 60311 Frankfurt",
    latitude: "50.1054",
    longitude: "8.6768",
  },
  {
    title: "Frankfurt Startup Pitch Night",
    body: "<p>Five members will pitch their startup ideas to the group. Attendees will vote for their favourite.</p>",
    groupSlug: "frankfurt",
    visibility: "global",
    authorIdx: 8,
    startOffsetDays: 25,
    durationHours: 3,
    city: "Frankfurt",
    country: "Germany",
    address: "Kap Europa, Osloer Str. 5, 60327 Frankfurt",
    latitude: "50.1044",
    longitude: "8.6513",
  },
  {
    title: "Cologne Members Dinner",
    body: "<p>A sit-down dinner for Cologne members. Tickets cover a three-course meal.</p>",
    groupSlug: "cologne",
    visibility: "group-only",
    authorIdx: -2,
    startOffsetDays: 9,
    durationHours: 3,
    city: "Cologne",
    country: "Germany",
    address: "Brauhaus Früh am Dom, Am Hof 12-14, 50667 Cologne",
    latitude: "50.9417",
    longitude: "6.9590",
  },
  {
    title: "Cologne Public Meet & Greet",
    body: "<p>Come and meet the Cologne community! Open event – bring a friend.</p>",
    groupSlug: "cologne",
    visibility: "global",
    authorIdx: 3,
    startOffsetDays: 35,
    durationHours: 4,
    city: "Cologne",
    country: "Germany",
    address: "Rheinpark, Sachsenbergstr., 50679 Cologne",
    latitude: "50.9440",
    longitude: "6.9831",
  },
  {
    title: "Checkout Matrix Demo Event",
    body: "<p>Demo event for testing checkout with multiple inventory groups and paid product choices.</p>",
    groupSlug: "berlin",
    visibility: "global",
    authorIdx: -1,
    startOffsetDays: 20,
    durationHours: 3,
    city: "Berlin",
    country: "Germany",
    address: "Betahaus, Rudi-Dutschke-Str. 23, 10969 Berlin",
    latitude: "52.5060",
    longitude: "13.3903",
  },
  {
    title: "Checkout QA Multi-Quantity & Participant Capacity",
    body: "<p>Purpose-built QA event for manual checkout validation: quantity controls, participant assignment, and autocomplete by name.</p>",
    groupSlug: "berlin",
    visibility: "global",
    authorIdx: -1,
    startOffsetDays: 16,
    durationHours: 4,
    city: "Berlin",
    country: "Germany",
    address: "MotionLab Berlin, Bouchestr. 12, 12435 Berlin",
    latitude: "52.4899",
    longitude: "13.4450",
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
    country: "Germany",
    address: "",
    latitude: "52.5200",
    longitude: "13.4050",
  },
  {
    title: "Past Meetup (E2E)",
    body: "<p>Past event used for E2E tests.</p>",
    groupSlug: "berlin",
    visibility: "global",
    authorIdx: -1,
    startOffsetDays: -30,
    durationHours: 2,
    city: "Berlin",
    country: "Germany",
    address: "Old Venue",
    latitude: "52.5200",
    longitude: "13.4000",
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
  "Berlin Summer Social",
  "Berlin Tech Talk: AI in 2025",
  "Berlin New Members Welcome Night",
  "Munich Community Hike – Englischer Garten",
  "Munich Members Workshop: Public Speaking",
  "Hamburg Harbour Morning Walk",
  "Hamburg Open Meetup",
  "Frankfurt Networking Breakfast",
  "Frankfurt Startup Pitch Night",
  "Cologne Members Dinner",
  "Cologne Public Meet & Greet",
  "All-Groups Online Town Hall",
  "Past Meetup (E2E)",
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
  eventTitle: "Berlin Summer Social",
  inventoryName: "General Admission",
  maxCapacity: 50,
  salesStartOffset: -7,
  salesEndOffset: 13,
  products: [
    { name: "Free Entry", price: 0, maxQuantity: 50, soldQuantity: 8 },
  ],
});

seedInventory({
  eventTitle: "Berlin Tech Talk: AI in 2025",
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
  eventTitle: "Berlin New Members Welcome Night",
  inventoryName: "Welcome Night Spots",
  maxCapacity: 20,
  salesStartOffset: -3,
  salesEndOffset: 6,
  products: [
    { name: "Welcome Night Ticket", price: 0, maxQuantity: 20, soldQuantity: 4 },
  ],
});

seedInventory({
  eventTitle: "Munich Community Hike – Englischer Garten",
  inventoryName: "Hike Spots",
  maxCapacity: 25,
  salesStartOffset: -7,
  salesEndOffset: 9,
  products: [
    { name: "Hiker Spot", price: 0, maxQuantity: 25, soldQuantity: 5 },
  ],
});

seedInventory({
  eventTitle: "Munich Members Workshop: Public Speaking",
  inventoryName: "Workshop Seats",
  maxCapacity: 15,
  salesStartOffset: -10,
  salesEndOffset: 29,
  products: [
    { name: "Workshop Ticket", price: 10, maxQuantity: 15, soldQuantity: 7 },
  ],
});

seedInventory({
  eventTitle: "Hamburg Harbour Morning Walk",
  inventoryName: "Walk Spots",
  maxCapacity: 15,
  salesStartOffset: -5,
  salesEndOffset: 5,
  products: [
    { name: "Walk Ticket", price: 0, maxQuantity: 15, soldQuantity: 3 },
  ],
});

seedInventory({
  eventTitle: "Hamburg Open Meetup",
  inventoryName: "Open Meetup Spots",
  maxCapacity: 40,
  salesStartOffset: -7,
  salesEndOffset: 17,
  products: [
    { name: "Free Entry", price: 0, maxQuantity: 40, soldQuantity: 6 },
  ],
});

seedInventory({
  eventTitle: "Frankfurt Networking Breakfast",
  inventoryName: "Breakfast Seats",
  maxCapacity: 20,
  salesStartOffset: -5,
  salesEndOffset: 11,
  products: [
    { name: "Breakfast Ticket (incl. food)", price: 12, maxQuantity: 20, soldQuantity: 5 },
  ],
});

seedInventory({
  eventTitle: "Frankfurt Startup Pitch Night",
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
  eventTitle: "Cologne Members Dinner",
  inventoryName: "Dinner Tickets",
  maxCapacity: 20,
  salesStartOffset: -1,
  salesEndOffset: 8,
  products: [
    { name: "Dinner Ticket (3-course meal)", price: 25, maxQuantity: 20, soldQuantity: 8 },
  ],
});

seedInventory({
  eventTitle: "Cologne Public Meet & Greet",
  inventoryName: "Meet & Greet Spots",
  maxCapacity: 40,
  salesStartOffset: -5,
  salesEndOffset: 34,
  products: [
    { name: "Free Entry", price: 0, maxQuantity: 40, soldQuantity: 4 },
  ],
});

seedInventory({
  eventTitle: "Checkout Matrix Demo Event",
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
  eventTitle: "Checkout Matrix Demo Event",
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
  eventTitle: "Checkout QA Multi-Quantity & Participant Capacity",
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
  eventTitle: "Checkout QA Multi-Quantity & Participant Capacity",
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

console.log("  inventory & products seeded");

// ─── 11b. Transactions, tickets, and participants ────────────────────────────

const allProducts = db.select().from(schema.products).all();
const productsByEvent: Record<string, typeof allProducts> = {};
for (const p of allProducts) {
  if (!productsByEvent[p.eventId]) productsByEvent[p.eventId] = [];
  productsByEvent[p.eventId].push(p);
}

/**
 * Create a transaction chain: transaction → transaction_items → tickets → ticket_participants.
 * Some tickets get scannedAt set (for past events / simulating check-in).
 */
function seedTransaction(opts: {
  eventTitle: string;
  buyerIdx: number;
  items: Array<{ productName: string; quantity: number }>;
  daysAgo: number;
  scanned?: boolean;
  /** When set, slot 1 of every ticket is assigned to this email instead of the buyer's */
  assignedToEmail?: string;
}) {
  const event = eventByTitle[opts.eventTitle];
  if (!event) return;
  const buyer = opts.buyerIdx >= 0 ? testUsers[opts.buyerIdx] : opts.buyerIdx === -1 ? adminUser! : hostUser!;
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
      console.warn(`  skipping product '${item.productName}' for '${opts.eventTitle}'`);
      continue;
    }
    totalAmount += product.price * item.quantity;
    const itemId = uuid();
    itemValues.push({
      id: itemId,
      transactionId: txId,
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.price,
    });

    // Create one ticket per quantity
    for (let q = 0; q < item.quantity; q++) {
      const ticketId = uuid();
      const purchaseDate = new Date();
      purchaseDate.setDate(purchaseDate.getDate() - opts.daysAgo);
      ticketValues.push({
        id: ticketId,
        qrCodeUuid: uuid(),
        transactionId: txId,
        productId: product.id,
        eventId: event.id,
        buyerId: buyer.id,
        scannedAt: opts.scanned ? new Date(new Date(event.startDate).getTime() + 30 * 60000).toISOString() : null,
        createdAt: purchaseDate.toISOString(),
      });
    }
  }

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

  for (const iv of itemValues) {
    db.insert(schema.transactionItems).values(iv).run();
  }

  for (const tv of ticketValues) {
    db.insert(schema.tickets).values(tv).run();
  }

  // Add participants to each ticket
  const FIRST_NAMES = ["Anna", "Ben", "Clara", "David", "Elena", "Felix", "Greta", "Hans", "Iris", "Jan"];
  const LAST_NAMES = ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Koch"];

  // Resolve the buyer's actual login email for correct assignedAway detection
  const buyerLogin = buyer.loginId
    ? db.select().from(schema.logins).all().find((l) => l.id === buyer.loginId)
    : null;
  const buyerEmail = buyerLogin?.email ?? null;

  for (const tv of ticketValues) {
    const product = eventProducts.find((p) => p.id === tv.productId);
    const capacity = product?.participantCapacity ?? 1;
    for (let p = 1; p <= capacity; p++) {
      const nameIdx = Math.floor(Math.random() * FIRST_NAMES.length);
      const lastIdx = Math.floor(Math.random() * LAST_NAMES.length);
      const first = p === 1 ? buyer.name : FIRST_NAMES[nameIdx];
      const last = p === 1 ? (buyer as any).familyName ?? "Seed" : LAST_NAMES[lastIdx];
      db.insert(schema.ticketParticipants)
        .values({
          id: uuid(),
          ticketId: tv.id,
          participantOrder: p,
          name: `${first} ${last}`,
          // Slot 1: use assignedToEmail override if provided, otherwise buyer's real email
          email: p === 1 && opts.assignedToEmail
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
seedTransaction({ eventTitle: "Past Meetup (E2E)", buyerIdx: 0, items: [{ productName: "Entry Ticket", quantity: 1 }], daysAgo: 35, scanned: true });
seedTransaction({ eventTitle: "Past Meetup (E2E)", buyerIdx: 1, items: [{ productName: "Entry Ticket", quantity: 2 }], daysAgo: 34, scanned: true });
seedTransaction({ eventTitle: "Past Meetup (E2E)", buyerIdx: 2, items: [{ productName: "Entry Ticket", quantity: 1 }], daysAgo: 33, scanned: true });
seedTransaction({ eventTitle: "Past Meetup (E2E)", buyerIdx: 3, items: [{ productName: "Entry Ticket", quantity: 1 }], daysAgo: 32, scanned: true });
seedTransaction({ eventTitle: "Past Meetup (E2E)", buyerIdx: -1, items: [{ productName: "Entry Ticket", quantity: 2 }], daysAgo: 38, scanned: true });
seedTransaction({ eventTitle: "Past Meetup (E2E)", buyerIdx: -2, items: [{ productName: "Entry Ticket", quantity: 1 }], daysAgo: 36, scanned: true });
seedTransaction({ eventTitle: "Past Meetup (E2E)", buyerIdx: 7, items: [{ productName: "Entry Ticket", quantity: 2 }], daysAgo: 31, scanned: true });

// ── Berlin Summer Social — mixed ──
seedTransaction({ eventTitle: "Berlin Summer Social", buyerIdx: 0, items: [{ productName: "Free Entry", quantity: 1 }], daysAgo: 5 });
seedTransaction({ eventTitle: "Berlin Summer Social", buyerIdx: 1, items: [{ productName: "Free Entry", quantity: 2 }], daysAgo: 4 });
seedTransaction({ eventTitle: "Berlin Summer Social", buyerIdx: 3, items: [{ productName: "Free Entry", quantity: 1 }], daysAgo: 3 });
seedTransaction({ eventTitle: "Berlin Summer Social", buyerIdx: 5, items: [{ productName: "Free Entry", quantity: 1 }], daysAgo: 2 });
seedTransaction({ eventTitle: "Berlin Summer Social", buyerIdx: 7, items: [{ productName: "Free Entry", quantity: 1 }], daysAgo: 2 });
seedTransaction({ eventTitle: "Berlin Summer Social", buyerIdx: 9, items: [{ productName: "Free Entry", quantity: 2 }], daysAgo: 1 });
// Admin buys a ticket but assigns it to a registered user (hidden from QR wall)
seedTransaction({ eventTitle: "Berlin Summer Social", buyerIdx: -1, items: [{ productName: "Free Entry", quantity: 1 }], daysAgo: 2, assignedToEmail: "user1@example.com" });

// ── Berlin Tech Talk — standard + VIP ──
seedTransaction({ eventTitle: "Berlin Tech Talk: AI in 2025", buyerIdx: 0, items: [{ productName: "Standard Seat", quantity: 1 }], daysAgo: 10 });
seedTransaction({ eventTitle: "Berlin Tech Talk: AI in 2025", buyerIdx: 1, items: [{ productName: "Standard Seat", quantity: 2 }], daysAgo: 8 });
seedTransaction({ eventTitle: "Berlin Tech Talk: AI in 2025", buyerIdx: 5, items: [{ productName: "VIP Seat (front row + networking)", quantity: 1 }], daysAgo: 7 });
seedTransaction({ eventTitle: "Berlin Tech Talk: AI in 2025", buyerIdx: 7, items: [{ productName: "Standard Seat", quantity: 1 }], daysAgo: 6 });
seedTransaction({ eventTitle: "Berlin Tech Talk: AI in 2025", buyerIdx: -1, items: [{ productName: "VIP Seat (front row + networking)", quantity: 1 }], daysAgo: 12 });
seedTransaction({ eventTitle: "Berlin Tech Talk: AI in 2025", buyerIdx: 3, items: [{ productName: "Standard Seat", quantity: 2 }], daysAgo: 5 });
// Admin buys 2 tickets: one for self (appears in QR wall), one assigned away to a registered user (hidden)
seedTransaction({ eventTitle: "Berlin Tech Talk: AI in 2025", buyerIdx: -1, items: [{ productName: "Standard Seat", quantity: 1 }], daysAgo: 3, assignedToEmail: "user2@example.com" });

// ── Welcome Night ──
seedTransaction({ eventTitle: "Berlin New Members Welcome Night", buyerIdx: 3, items: [{ productName: "Welcome Night Ticket", quantity: 1 }], daysAgo: 2 });
seedTransaction({ eventTitle: "Berlin New Members Welcome Night", buyerIdx: 7, items: [{ productName: "Welcome Night Ticket", quantity: 1 }], daysAgo: 2 });
seedTransaction({ eventTitle: "Berlin New Members Welcome Night", buyerIdx: 9, items: [{ productName: "Welcome Night Ticket", quantity: 1 }], daysAgo: 1 });
seedTransaction({ eventTitle: "Berlin New Members Welcome Night", buyerIdx: -2, items: [{ productName: "Welcome Night Ticket", quantity: 1 }], daysAgo: 3 });
// Admin buys a ticket assigned to a registered user (should NOT appear in admin's QR wall)
seedTransaction({ eventTitle: "Berlin New Members Welcome Night", buyerIdx: -1, items: [{ productName: "Welcome Night Ticket", quantity: 1 }], daysAgo: 1, assignedToEmail: "user3@example.com" });

// ── Munich Hike ──
seedTransaction({ eventTitle: "Munich Community Hike – Englischer Garten", buyerIdx: 2, items: [{ productName: "Hiker Spot", quantity: 1 }], daysAgo: 6 });
seedTransaction({ eventTitle: "Munich Community Hike – Englischer Garten", buyerIdx: 5, items: [{ productName: "Hiker Spot", quantity: 2 }], daysAgo: 4 });
seedTransaction({ eventTitle: "Munich Community Hike – Englischer Garten", buyerIdx: 7, items: [{ productName: "Hiker Spot", quantity: 1 }], daysAgo: 3 });
seedTransaction({ eventTitle: "Munich Community Hike – Englischer Garten", buyerIdx: -1, items: [{ productName: "Hiker Spot", quantity: 1 }], daysAgo: 5 });

// ── Munich Workshop (paid) ──
seedTransaction({ eventTitle: "Munich Members Workshop: Public Speaking", buyerIdx: 2, items: [{ productName: "Workshop Ticket", quantity: 1 }], daysAgo: 14 });
seedTransaction({ eventTitle: "Munich Members Workshop: Public Speaking", buyerIdx: 5, items: [{ productName: "Workshop Ticket", quantity: 1 }], daysAgo: 12 });
seedTransaction({ eventTitle: "Munich Members Workshop: Public Speaking", buyerIdx: 7, items: [{ productName: "Workshop Ticket", quantity: 2 }], daysAgo: 10 });
seedTransaction({ eventTitle: "Munich Members Workshop: Public Speaking", buyerIdx: 0, items: [{ productName: "Workshop Ticket", quantity: 1 }], daysAgo: 9 });
seedTransaction({ eventTitle: "Munich Members Workshop: Public Speaking", buyerIdx: -1, items: [{ productName: "Workshop Ticket", quantity: 2 }], daysAgo: 15 });

// ── Hamburg Walk ──
seedTransaction({ eventTitle: "Hamburg Harbour Morning Walk", buyerIdx: 1, items: [{ productName: "Walk Ticket", quantity: 1 }], daysAgo: 3 });
seedTransaction({ eventTitle: "Hamburg Harbour Morning Walk", buyerIdx: 6, items: [{ productName: "Walk Ticket", quantity: 1 }], daysAgo: 2 });
seedTransaction({ eventTitle: "Hamburg Harbour Morning Walk", buyerIdx: 3, items: [{ productName: "Walk Ticket", quantity: 1 }], daysAgo: 1 });

// ── Hamburg Open Meetup ──
seedTransaction({ eventTitle: "Hamburg Open Meetup", buyerIdx: 1, items: [{ productName: "Free Entry", quantity: 1 }], daysAgo: 4 });
seedTransaction({ eventTitle: "Hamburg Open Meetup", buyerIdx: 3, items: [{ productName: "Free Entry", quantity: 2 }], daysAgo: 3 });
seedTransaction({ eventTitle: "Hamburg Open Meetup", buyerIdx: 6, items: [{ productName: "Free Entry", quantity: 1 }], daysAgo: 2 });
seedTransaction({ eventTitle: "Hamburg Open Meetup", buyerIdx: 8, items: [{ productName: "Free Entry", quantity: 2 }], daysAgo: 1 });

// ── Frankfurt Breakfast (paid) ──
seedTransaction({ eventTitle: "Frankfurt Networking Breakfast", buyerIdx: 2, items: [{ productName: "Breakfast Ticket (incl. food)", quantity: 1 }], daysAgo: 7 });
seedTransaction({ eventTitle: "Frankfurt Networking Breakfast", buyerIdx: 4, items: [{ productName: "Breakfast Ticket (incl. food)", quantity: 2 }], daysAgo: 5 });
seedTransaction({ eventTitle: "Frankfurt Networking Breakfast", buyerIdx: 8, items: [{ productName: "Breakfast Ticket (incl. food)", quantity: 1 }], daysAgo: 4 });
seedTransaction({ eventTitle: "Frankfurt Networking Breakfast", buyerIdx: -2, items: [{ productName: "Breakfast Ticket (incl. food)", quantity: 1 }], daysAgo: 6 });

// ── Frankfurt Pitch Night (paid + free pitcher) ──
seedTransaction({ eventTitle: "Frankfurt Startup Pitch Night", buyerIdx: 4, items: [{ productName: "Audience Ticket", quantity: 2 }], daysAgo: 10 });
seedTransaction({ eventTitle: "Frankfurt Startup Pitch Night", buyerIdx: 8, items: [{ productName: "Audience Ticket", quantity: 3 }], daysAgo: 8 });
seedTransaction({ eventTitle: "Frankfurt Startup Pitch Night", buyerIdx: 2, items: [{ productName: "Audience Ticket", quantity: 2 }], daysAgo: 7 });
seedTransaction({ eventTitle: "Frankfurt Startup Pitch Night", buyerIdx: 6, items: [{ productName: "Audience Ticket", quantity: 1 }], daysAgo: 6 });
seedTransaction({ eventTitle: "Frankfurt Startup Pitch Night", buyerIdx: 0, items: [{ productName: "Pitcher Ticket (present your startup)", quantity: 1 }], daysAgo: 14 });
seedTransaction({ eventTitle: "Frankfurt Startup Pitch Night", buyerIdx: 4, items: [{ productName: "Pitcher Ticket (present your startup)", quantity: 1 }], daysAgo: 12 });
seedTransaction({ eventTitle: "Frankfurt Startup Pitch Night", buyerIdx: -1, items: [{ productName: "Audience Ticket", quantity: 4 }], daysAgo: 9 });
seedTransaction({ eventTitle: "Frankfurt Startup Pitch Night", buyerIdx: 9, items: [{ productName: "Pitcher Ticket (present your startup)", quantity: 1 }], daysAgo: 11 });

// ── Cologne Dinner (paid) ──
seedTransaction({ eventTitle: "Cologne Members Dinner", buyerIdx: 3, items: [{ productName: "Dinner Ticket (3-course meal)", quantity: 2 }], daysAgo: 5 });
seedTransaction({ eventTitle: "Cologne Members Dinner", buyerIdx: 8, items: [{ productName: "Dinner Ticket (3-course meal)", quantity: 1 }], daysAgo: 4 });
seedTransaction({ eventTitle: "Cologne Members Dinner", buyerIdx: -2, items: [{ productName: "Dinner Ticket (3-course meal)", quantity: 2 }], daysAgo: 6 });
seedTransaction({ eventTitle: "Cologne Members Dinner", buyerIdx: 4, items: [{ productName: "Dinner Ticket (3-course meal)", quantity: 1 }], daysAgo: 3 });
seedTransaction({ eventTitle: "Cologne Members Dinner", buyerIdx: 0, items: [{ productName: "Dinner Ticket (3-course meal)", quantity: 2 }], daysAgo: 7 });

// ── Cologne Meet & Greet ──
seedTransaction({ eventTitle: "Cologne Public Meet & Greet", buyerIdx: 3, items: [{ productName: "Free Entry", quantity: 1 }], daysAgo: 3 });
seedTransaction({ eventTitle: "Cologne Public Meet & Greet", buyerIdx: 8, items: [{ productName: "Free Entry", quantity: 1 }], daysAgo: 2 });
seedTransaction({ eventTitle: "Cologne Public Meet & Greet", buyerIdx: -2, items: [{ productName: "Free Entry", quantity: 1 }], daysAgo: 2 });
seedTransaction({ eventTitle: "Cologne Public Meet & Greet", buyerIdx: 4, items: [{ productName: "Free Entry", quantity: 1 }], daysAgo: 1 });

// ── Town Hall (global, free) ──
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: -1, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 10 });
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: 0, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 8 });
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: 2, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 7 });
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: 4, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 6 });
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: 6, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 5 });
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: 8, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 4 });
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: -2, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 3 });
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: 1, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 2 });
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: 3, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 2 });
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: 5, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 1 });
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: 7, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 1 });
seedTransaction({ eventTitle: "All-Groups Online Town Hall", buyerIdx: 9, items: [{ productName: "Virtual Seat", quantity: 1 }], daysAgo: 1 });

const txCount = db.select().from(schema.transactions).all().length;
const ticketCount = db.select().from(schema.tickets).all().length;
const participantCount = db.select().from(schema.ticketParticipants).all().length;
console.log(`  transactions seeded (${txCount} transactions, ${ticketCount} tickets, ${participantCount} participants)`);

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

for (let i = 0; i < qaCheckoutUsers.length; i++) {
  db.update(schema.users)
    .set({
      profilePicture: imageKeys[(i + 2) % imageKeys.length],
      updatedAt: now(),
    })
    .where(eq(schema.users.id, qaCheckoutUsers[i].id))
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
console.log(`  user profile pictures assigned (${usersWithoutProfile.length} users, QA users emphasized=${qaCheckoutUsers.length})`);
console.log("  checkout QA scenario ready:");
console.log("    Event: Checkout QA Multi-Quantity & Participant Capacity");
console.log("    Products: QA Standard Pass, QA Premium Pass, QA Pair Workshop (2 participants), QA Trio Lab (3 participants)");
console.log("    Search users: Marta Keller, Jonas Richter, Leonie Baumann, Tariq Hassan");

// ─── 13. Forms ───────────────────────────────────────────────────────────────

const onboardJson = JSON.parse(fs.readFileSync("surveys/onboard.json", "utf-8"));

const formDefs: Array<{
  title: string;
  slug: string;
  description: string;
  schemaJson: any;
  visibility: "private" | "public";
  isSystemForm: boolean;
  systemKey: string | null;
}> = [
  {
    title: "Onboarding Survey",
    slug: "onboarding",
    description: "Required during signup — captures how you know us and your academic background.",
    schemaJson: onboardJson,
    visibility: "private",
    isSystemForm: true,
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
      systemKey: f.systemKey,
      createdBy: adminUser.id,
      createdAt: now(),
      updatedAt: now(),
    })
    .run();
}
console.log(`  forms seeded (${formDefs.length})`);

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
      { id: uuid(), componentType: "TitleBlock", order: 2, data: { text: "What We Do", level: "2", align: "center" } },
      { id: uuid(), componentType: "TextBlock", order: 3, data: { content: "<p>We bring together people from all walks of life to build meaningful connections, share knowledge, and grow together. Our local communities across Germany organise regular meetups, workshops, and social events.</p>" } },
      { id: uuid(), componentType: "SpacerBlock", order: 4, data: { height: 40 } },
      { id: uuid(), componentType: "FeatureBlock", order: 5, data: { layout: '"left-top middle right-top" "left-bottom middle right-top" "left-bottom middle right-bottom"', gap: 24, tilesJson: DEFAULT_TILES } },
      { id: uuid(), componentType: "SpacerBlock", order: 6, data: { height: 40 } },
      { id: uuid(), componentType: "TitleBlock", order: 7, data: { text: "Upcoming Events", level: "2", align: "center" } },
      { id: uuid(), componentType: "UpcomingEventsBlock", order: 8, data: {} },
      { id: uuid(), componentType: "SpacerBlock", order: 9, data: { height: 40 } },
      { id: uuid(), componentType: "TitleBlock", order: 10, data: { text: "Our Communities", level: "2", align: "center" } },
      { id: uuid(), componentType: "GroupsListBlock", order: 11, data: {} },
      { id: uuid(), componentType: "SpacerBlock", order: 12, data: { height: 40 } },
      { id: uuid(), componentType: "TitleBlock", order: 13, data: { text: "Latest Posts", level: "2", align: "center" } },
      { id: uuid(), componentType: "PostsListBlock", order: 14, data: { limit: 6 } },
    ],
  },
  {
    title: "About Us",
    slug: "/about-us",
    status: "published",
    content: [
      { id: uuid(), componentType: "TitleBlock", order: 0, data: { text: "About Us", level: "1", align: "center" } },
      { id: uuid(), componentType: "SpacerBlock", order: 1, data: { height: 20 } },
      { id: uuid(), componentType: "TextBlock", order: 2, data: { content: "<p>We started as a small group of friends who wanted to build a space for people to connect beyond the usual networking events. What began in Berlin quickly spread to Munich, Hamburg, Frankfurt, and Cologne.</p><p>Today, we are a growing community of over 2,000 members across Germany. Our mission is simple: bring people together, foster genuine relationships, and create opportunities for personal and professional growth.</p>" } },
      { id: uuid(), componentType: "SpacerBlock", order: 3, data: { height: 40 } },
      { id: uuid(), componentType: "ImageBlock", order: 4, data: { src: "https://picsum.photos/800/400", alt: "Community gathering", caption: "" } },
      { id: uuid(), componentType: "SpacerBlock", order: 5, data: { height: 40 } },
      { id: uuid(), componentType: "TitleBlock", order: 6, data: { text: "Our Values", level: "2", align: "left" } },
      { id: uuid(), componentType: "TextBlock", order: 7, data: { content: "<p><strong>Openness</strong> — Everyone is welcome, regardless of background or experience.</p><p><strong>Authenticity</strong> — We value real connections over superficial networking.</p><p><strong>Local Roots</strong> — Each community is shaped by its members and the city it calls home.</p>" } },
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
      { id: uuid(), componentType: "LocalCommunitiesMapBlock", order: 3, data: {} },
      { id: uuid(), componentType: "SpacerBlock", order: 4, data: { height: 40 } },
      { id: uuid(), componentType: "GroupsListBlock", order: 5, data: {} },
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
  { menuName: "main", title: "Home", url: "/", position: 0, hasPage: true },
  { menuName: "main", title: "Events", url: "/events", position: 1, hasPage: true },
  { menuName: "main", title: "Communities", url: "/communities", position: 2, hasPage: true },
  { menuName: "main", title: "Jobs", url: "/jobs", position: 3 },
  { menuName: "main", title: "About Us", url: "/about-us", position: 4, hasPage: true },
  { menuName: "footer", title: "Home", url: "/", position: 0, hasPage: true },
  { menuName: "footer", title: "Events", url: "/events", position: 1, hasPage: true },
  { menuName: "footer", title: "Communities", url: "/communities", position: 2, hasPage: true },
  { menuName: "footer", title: "About Us", url: "/about-us", position: 3, hasPage: true },
  { menuName: "footer", title: "Deals", url: "/deals", position: 4, hasPage: true },
  { menuName: "footer", title: "Jobs", url: "/jobs", position: 5 },
  { menuName: "footer", title: "Contact", url: "/contact", position: 6 },
  { menuName: "footer", title: "Privacy Policy", url: "/privacy", position: 7 },
  { menuName: "footer", title: "Terms of Service", url: "/terms", position: 8 },
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

// Upload the seed SVG logo to S3 once, reuse the key for all deals
async function uploadSeedSvg(): Promise<string | null> {
  const svgPath = path.join(process.cwd(), "instagram-logo-facebook-2-svgrepo-com.svg");
  if (!fs.existsSync(svgPath)) {
    console.warn("  SVG file not found, skipping logo upload for deals");
    return null;
  }

  const s3 = new S3Client({
    region: seedStorageConfig.region,
    endpoint: seedStorageConfig.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: seedStorageConfig.accessKeyId,
      secretAccessKey: seedStorageConfig.secretAccessKey,
    },
  });

  const svgKey = "public/deals/logos/seed-logo.svg";
  await s3.send(
    new PutObjectCommand({
      Bucket: seedStorageConfig.bucket,
      Key: svgKey,
      Body: fs.readFileSync(svgPath),
      ContentType: "image/svg+xml",
      CacheControl: "public, max-age=86400",
    }),
  );
  return svgKey;
}

const svgLogoKey = await uploadSeedSvg();

const dealDefs: Array<{
  name: string;
  description: string;
  validUntilOffsetDays: number | null;
  steps: schema.DealStep[];
}> = [
  {
    name: "10% Off at Partner Café",
    description: "Enjoy an exclusive 10% discount at our partner café chain across all German locations.",
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
    name: "Free Month at FitSpace Gym",
    description: "Get your first month completely free at any FitSpace gym in Germany.",
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
    name: "20% Off Co-Working Day Pass",
    description: "Work from one of our co-working partner spaces at a special member rate.",
    validUntilOffsetDays: null,
    steps: [
      {
        type: "text",
        title: "Valid Locations",
        text: "Valid at all SpaceHub co-working locations in Berlin, Munich, Hamburg, Frankfurt and Cologne.",
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
  const validUntil =
    d.validUntilOffsetDays !== null ? daysFromNow(d.validUntilOffsetDays) : null;
  db.insert(schema.deals)
    .values({
      id: uuid(),
      name: d.name,
      description: d.description,
      logo: svgLogoKey,
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
    body: `<h2>About the role</h2><p>We are looking for a Senior Full-Stack Engineer to join our product team in Berlin. You will own features end-to-end — from database design through to the user interface.</p><h2>What you'll do</h2><ul><li>Design and build scalable backend APIs with Node.js</li><li>Develop responsive frontend components in React or similar</li><li>Collaborate with product and design in a small, fast-moving team</li></ul><h2>What we're looking for</h2><ul><li>5+ years of professional software development experience</li><li>Solid TypeScript and SQL skills</li><li>Strong communication and ownership mindset</li></ul>`,
    locationType: "on-site",
    city: "Berlin",
    country: "Germany",
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
    title: "Data Analyst — Germany",
    body: `<h2>What you'll be doing</h2><p>Join our analytics team and help us turn data into decisions. You'll build dashboards, run analyses, and work with stakeholders across the business.</p><h2>Skills & experience</h2><ul><li>Strong SQL and Python skills</li><li>Experience with BI tools such as Metabase or Looker</li><li>Comfortable presenting findings to non-technical audiences</li></ul>`,
    locationType: "remote-country",
    country: "Germany",
    posterRelation: "works-there",
    expiresAtOffsetDays: 18,
    status: "approved",
    authorIdx: 4,
  },
  {
    title: "Community Manager — Munich",
    body: `<h2>About this role</h2><p>We are growing our Munich presence and are looking for a Community Manager to cultivate and grow the local member base. You'll organise events, onboard new members, and be the face of the community in the city.</p><h2>What we need</h2><ul><li>Excellent interpersonal and organisational skills</li><li>Experience planning and running events</li><li>Fluency in German and English</li></ul>`,
    locationType: "on-site",
    city: "Munich",
    country: "Germany",
    posterRelation: "founder",
    expiresAtOffsetDays: 28,
    status: "approved",
    authorIdx: 7,
  },
  {
    title: "Backend Engineer — Pending Review",
    body: `<h2>The role</h2><p>We are hiring a Backend Engineer to work on our core platform API. This is a full-time position based in Frankfurt.</p><h2>Requirements</h2><ul><li>3+ years backend experience (Go, Node.js, or Python)</li><li>Experience with REST and/or GraphQL APIs</li><li>Familiarity with cloud infrastructure (AWS, GCP)</li></ul>`,
    locationType: "on-site",
    city: "Frankfurt",
    country: "Germany",
    link: "https://example.com/jobs/backend-engineer",
    posterRelation: "hiring",
    expiresAtOffsetDays: 30,
    status: "pending",
    authorIdx: 1,
  },
  {
    title: "Marketing Lead — Pending Review",
    body: `<h2>Overview</h2><p>We are looking for a Marketing Lead to own our growth channels and brand strategy across Germany.</p><h2>What you'll do</h2><ul><li>Define and execute the marketing roadmap</li><li>Manage social media, email, and paid channels</li><li>Measure and report on campaign performance</li></ul>`,
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
    city: "Hamburg",
    country: "Germany",
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

// ─── 20. Elections ────────────────────────────────────────────────────────────

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
    description: "Nominations are open for the 2026–2028 board term. Full members may apply.",
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
      .values({ id, title: c.title, year: c.year, description: c.description, status: c.status, requiredMembershipTier: c.requiredMembershipTier, createdAt: now(), updatedAt: now() })
      .run();
    cycleIdByTitle[c.title] = id;
    console.log(`  created election cycle '${c.title}'`);
  }
}

const positionDefs: Array<{ cycleTitle: string; title: string; description: string }> = [
  { cycleTitle: "Board Elections 2024", title: "Board President", description: "Leads the board and chairs meetings." },
  { cycleTitle: "Board Elections 2024", title: "Secretary", description: "Manages communication and minutes." },
  { cycleTitle: "Board Elections 2026", title: "Board President", description: "Leads the board and chairs meetings." },
  { cycleTitle: "Board Elections 2026", title: "Treasurer", description: "Oversees finances and budgeting." },
  { cycleTitle: "Board Elections 2026", title: "Secretary", description: "Manages communication and minutes." },
];

const existingPositions = db.select().from(schema.electionPositions).all();
const positionIdByKey: Record<string, string> = {};

for (const p of positionDefs) {
  const cycleId = cycleIdByTitle[p.cycleTitle];
  if (!cycleId) continue;
  const key = `${p.cycleTitle}::${p.title}`;
  const existing = existingPositions.find((ep) => ep.cycleId === cycleId && ep.title === p.title);
  if (existing) {
    positionIdByKey[key] = existing.id;
  } else {
    const id = uuid();
    db.insert(schema.electionPositions)
      .values({ id, cycleId, title: p.title, description: p.description, createdAt: now() })
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
  // 2024 historical (closed cycle)
  { cycleTitle: "Board Elections 2024", positionTitle: "Board President", userIdx: 0, status: "approved" },
  { cycleTitle: "Board Elections 2024", positionTitle: "Secretary", userIdx: 2, status: "approved" },
  { cycleTitle: "Board Elections 2024", positionTitle: "Secretary", userIdx: 6, status: "rejected", adminNote: "Withdrew candidacy before vote." },

  // 2026 active (open cycle)
  { cycleTitle: "Board Elections 2026", positionTitle: "Board President", userIdx: 0, status: "pending" },
  { cycleTitle: "Board Elections 2026", positionTitle: "Board President", userIdx: 2, status: "pending" },
  { cycleTitle: "Board Elections 2026", positionTitle: "Treasurer", userIdx: 1, status: "approved" },
  { cycleTitle: "Board Elections 2026", positionTitle: "Secretary", userIdx: 6, status: "approved" },
  { cycleTitle: "Board Elections 2026", positionTitle: "Secretary", userIdx: -1, status: "rejected", adminNote: "Admin cannot serve on the board while also administering the platform." },
];

const existingApplications = db.select().from(schema.electionApplications).all();

for (const a of applicationDefs) {
  const cycleId = cycleIdByTitle[a.cycleTitle];
  const positionId = positionIdByKey[`${a.cycleTitle}::${a.positionTitle}`];
  const userId = a.userIdx === -1 ? adminUser!.id : testUsers[a.userIdx]?.id;
  if (!cycleId || !positionId || !userId) continue;

  const exists = existingApplications.find((ea) => ea.positionId === positionId && ea.userId === userId);
  if (exists) continue;

  db.insert(schema.electionApplications)
    .values({
      id: uuid(),
      positionId,
      cycleId,
      userId,
      status: a.status,
      motivationWhy: "I am passionate about the community and believe I can contribute meaningfully to its direction and growth.",
      motivationExperience: "I have been an active member for several years and have organised multiple events across different cities.",
      motivationGoals: "I want to strengthen member engagement, improve transparency in decision-making, and grow our local chapters.",
      adminNote: a.adminNote ?? null,
      createdAt: now(),
      updatedAt: now(),
    })
    .run();
}

const electionCycleCount = db.select().from(schema.electionCycles).all().length;
const electionPositionCount = db.select().from(schema.electionPositions).all().length;
const electionApplicationCount = db.select().from(schema.electionApplications).all().length;
console.log(`  elections seeded (${electionCycleCount} cycles, ${electionPositionCount} positions, ${electionApplicationCount} applications)`);

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
  transactions: db.select().from(schema.transactions).all().length,
  tickets: db.select().from(schema.tickets).all().length,
  ticketParticipants: db.select().from(schema.ticketParticipants).all().length,
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
  electionCycles: db.select().from(schema.electionCycles).all().length,
  electionPositions: db.select().from(schema.electionPositions).all().length,
  electionApplications: db.select().from(schema.electionApplications).all().length,
};

console.log("\n✅ Seed complete:");
for (const [k, v] of Object.entries(counts)) {
  console.log(`   ${k}: ${v}`);
}

sqlite.close();

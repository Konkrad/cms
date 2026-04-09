/**
 * Seed script — the single entry point for creating a local dev / E2E database.
 *
 * Usage:
 *   npx tsx scripts/seed.ts          # normal seed (keeps existing DB)
 *   npx tsx scripts/seed.ts --fresh  # deletes DB and starts from scratch
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/db/schema.ts";
import crypto from "crypto";
import fs from "fs";
import { execSync } from "child_process";

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
const db = drizzle(sqlite, { schema });

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

// ─── 4. Base users ───────────────────────────────────────────────────────────

const existingUsers = db.select().from(schema.users).all();

let adminUser = existingUsers.find((u) => u.role === "admin" && u.name === "Konrad");
let hostUser = existingUsers.find((u) => u.name === "Host");

if (!adminUser) {
  const id = uuid();
  db.insert(schema.users)
    .values({ id, name: "Konrad", familyName: "Admin", role: "admin", createdAt: now(), updatedAt: now() })
    .run();
  adminUser = db.select().from(schema.users).all().find((u) => u.id === id)!;
  console.log("  created admin user 'Konrad'");
}

if (!hostUser) {
  const id = uuid();
  db.insert(schema.users)
    .values({ id, name: "Host", familyName: "User", role: "admin", createdAt: now(), updatedAt: now() })
    .run();
  hostUser = db.select().from(schema.users).all().find((u) => u.id === id)!;
  console.log("  created host user 'Host'");
}

let testUsers = db
  .select()
  .from(schema.users)
  .all()
  .filter((u) => u.role === "user" && u.familyName === "Test");

if (testUsers.length < 10) {
  for (let i = testUsers.length; i < 10; i++) {
    db.insert(schema.users)
      .values({ id: uuid(), name: `User${i + 1}`, familyName: "Test", role: "user", createdAt: now(), updatedAt: now() })
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
  { userId: testUsers[0]?.id, groupSlug: "berlin" },
  { userId: testUsers[2]?.id, groupSlug: "munich" },
  { userId: testUsers[6]?.id, groupSlug: "hamburg" },
  { userId: testUsers[4]?.id, groupSlug: "frankfurt" },
  { userId: testUsers[8]?.id, groupSlug: "cologne" },
  { userId: hostUser.id, groupSlug: "berlin" },
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

const testEvent = db.select().from(schema.events).all().find((e) => e.title === "Berlin Summer Social");
if (testEvent) {
  const statuses = ["yes", "no", "maybe"] as const;
  for (let i = 0; i < testUsers.length; i++) {
    db.insert(schema.participationStatus)
      .values({
        id: uuid(),
        userId: testUsers[i].id,
        eventId: testEvent.id,
        status: statuses[i % 3],
        updatedAt: now(),
      })
      .run();
  }
  console.log("  participation statuses seeded");
}

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
        imageUrl: null,
        stripeProductId: null,
        soldQuantity: p.soldQuantity ?? 0,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
  }
}

seedInventory({
  eventTitle: "Cologne Members Dinner",
  inventoryName: "Dinner Tickets",
  maxCapacity: 20,
  salesStartOffset: -1,
  salesEndOffset: 30,
  products: [{ name: "Dinner Ticket", price: 25.0, maxQuantity: 20 }],
});

seedInventory({
  eventTitle: "Munich Members Workshop: Public Speaking",
  inventoryName: "Workshop Seats",
  maxCapacity: 2,
  salesStartOffset: -10,
  salesEndOffset: 30,
  products: [{ name: "Workshop Ticket", price: 0, maxQuantity: 2, soldQuantity: 2 }],
});

seedInventory({
  eventTitle: "Hamburg Harbour Morning Walk",
  inventoryName: "Walk Spots",
  maxCapacity: 1,
  salesStartOffset: -5,
  salesEndOffset: 10,
  products: [{ name: "Walk Ticket", price: 0, maxQuantity: 1, soldQuantity: 1 }],
});

console.log("  inventory & products seeded");

// ─── 12. Placeholder images ──────────────────────────────────────────────────

const IMG_BASE = "http://localhost:9000/data/public/events/";
const imgs = [
  "1ca6d59d-64fe-4ad2-aa48-e4d7fb693121.webp",
  "604eba88-a38e-4325-80a0-1d8646a96a59.webp",
  "1707077845237.webp",
  "Photo%27s%20in%20detail.webp",
];
const imgUrls = imgs.map((f) => IMG_BASE + f);

const eventsNoImg = sqlite
  .prepare("SELECT id FROM events WHERE deleted_at IS NULL AND (image1 IS NULL OR image2 IS NULL)")
  .all() as Array<{ id: string }>;
const updateEvent = sqlite.prepare("UPDATE events SET image1 = ?, image2 = ? WHERE id = ?");
for (let i = 0; i < eventsNoImg.length; i++) {
  updateEvent.run(imgUrls[i % imgUrls.length], imgUrls[(i + 1) % imgUrls.length], eventsNoImg[i].id);
}

const postsNoImg = sqlite
  .prepare("SELECT id FROM posts WHERE deleted_at IS NULL AND featured_image IS NULL")
  .all() as Array<{ id: string }>;
const updatePost = sqlite.prepare("UPDATE posts SET featured_image = ? WHERE id = ?");
for (let i = 0; i < postsNoImg.length; i++) {
  updatePost.run(imgUrls[i % imgUrls.length], postsNoImg[i].id);
}

const groupsNoImg = sqlite
  .prepare("SELECT id FROM groups WHERE image1 IS NULL OR image2 IS NULL OR image3 IS NULL")
  .all() as Array<{ id: string }>;
const updateGroup = sqlite.prepare("UPDATE groups SET image1 = ?, image2 = ?, image3 = ? WHERE id = ?");
for (let i = 0; i < groupsNoImg.length; i++) {
  updateGroup.run(imgUrls[i % imgUrls.length], imgUrls[(i + 1) % imgUrls.length], imgUrls[(i + 2) % imgUrls.length], groupsNoImg[i].id);
}

console.log(`  images seeded (${eventsNoImg.length} events, ${postsNoImg.length} posts, ${groupsNoImg.length} groups)`);

// ─── Done ────────────────────────────────────────────────────────────────────

const counts = {
  users: db.select().from(schema.users).all().length,
  groups: db.select().from(schema.groups).all().length,
  memberships: db.select().from(schema.groupMemberships).all().length,
  reps: db.select().from(schema.groupRepresentatives).all().length,
  posts: db.select().from(schema.posts).all().length,
  events: db.select().from(schema.events).all().length,
};

console.log("\n✅ Seed complete:");
for (const [k, v] of Object.entries(counts)) {
  console.log(`   ${k}: ${v}`);
}

sqlite.close();

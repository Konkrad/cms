/**
 * Test-data seed script.
 * Run with:  npx tsx scripts/seed.ts
 *
 * Idempotent for groups/users – skips rows that already exist.
 * Appends fresh events/posts/memberships every run.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import crypto from "crypto";

const sqlite = new Database("my-database.db");
const db = drizzle(sqlite, { schema });

// ─── helpers ────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

// ─── existing data ───────────────────────────────────────────────────────────

const existingUsers = db.select().from(schema.users).all();
const existingGroups = db.select().from(schema.groups).all();

const userMap = Object.fromEntries(existingUsers.map((u) => [u.id, u]));
const adminUser = existingUsers.find((u) => u.role === "admin" && u.name === "Konrad");
const hostUser = existingUsers.find((u) => u.name === "Host");
const testUsers = existingUsers.filter((u) => u.role === "user");

if (!adminUser) throw new Error("Admin user 'Konrad' not found – run the app first.");
if (!hostUser) throw new Error("Host user not found – run the app first.");

console.log(`Found ${existingUsers.length} users, ${existingGroups.length} existing groups.`);

// ─── groups ──────────────────────────────────────────────────────────────────

const groupDefs = [
  { name: "Berlin",       slug: "berlin",       latitude: "52.5200", longitude: "13.4050" },
  { name: "Munich",       slug: "munich",       latitude: "48.1351", longitude: "11.5820" },
  { name: "Hamburg",      slug: "hamburg",      latitude: "53.5511", longitude: "9.9937"  },
  { name: "Frankfurt",    slug: "frankfurt",    latitude: "50.1109", longitude: "8.6821"  },
  { name: "Cologne",      slug: "cologne",      latitude: "50.9333", longitude: "6.9500"  },
];

const groupIds: Record<string, string> = {};

for (const def of groupDefs) {
  const existing = existingGroups.find((g) => g.slug === def.slug);
  if (existing) {
    groupIds[def.slug] = existing.id;
    console.log(`  group '${def.name}' already exists – skipping`);
  } else {
    const id = uuid();
    db.insert(schema.groups).values({
      id,
      name: def.name,
      slug: def.slug,
      latitude: def.latitude,
      longitude: def.longitude,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).run();
    groupIds[def.slug] = id;
    console.log(`  created group '${def.name}' (${id})`);
  }
}

// ─── memberships ─────────────────────────────────────────────────────────────

// Assign test users deterministically to groups
// Each user joins 1-3 groups; everyone is in at least one group
const membershipPlan: Array<{ userId: string; groupSlug: string }> = [
  { userId: testUsers[0]?.id,  groupSlug: "berlin"   },
  { userId: testUsers[0]?.id,  groupSlug: "munich"   },
  { userId: testUsers[1]?.id,  groupSlug: "berlin"   },
  { userId: testUsers[1]?.id,  groupSlug: "hamburg"  },
  { userId: testUsers[2]?.id,  groupSlug: "munich"   },
  { userId: testUsers[2]?.id,  groupSlug: "frankfurt" },
  { userId: testUsers[3]?.id,  groupSlug: "berlin"   },
  { userId: testUsers[3]?.id,  groupSlug: "cologne"  },
  { userId: testUsers[3]?.id,  groupSlug: "hamburg"  },
  { userId: testUsers[4]?.id,  groupSlug: "frankfurt" },
  { userId: testUsers[4]?.id,  groupSlug: "cologne"  },
  { userId: testUsers[5]?.id,  groupSlug: "munich"   },
  { userId: testUsers[5]?.id,  groupSlug: "berlin"   },
  { userId: testUsers[5]?.id,  groupSlug: "cologne"  },
  { userId: testUsers[6]?.id,  groupSlug: "hamburg"  },
  { userId: testUsers[6]?.id,  groupSlug: "frankfurt" },
  { userId: testUsers[7]?.id,  groupSlug: "berlin"   },
  { userId: testUsers[7]?.id,  groupSlug: "munich"   },
  { userId: testUsers[7]?.id,  groupSlug: "hamburg"  },
  { userId: testUsers[8]?.id,  groupSlug: "cologne"  },
  { userId: testUsers[8]?.id,  groupSlug: "frankfurt" },
  { userId: testUsers[9]?.id,  groupSlug: "berlin"   },
  { userId: testUsers[9]?.id,  groupSlug: "munich"   },
  { userId: testUsers[9]?.id,  groupSlug: "frankfurt" },
  // admins also join groups
  { userId: adminUser.id,      groupSlug: "berlin"   },
  { userId: adminUser.id,      groupSlug: "munich"   },
  { userId: hostUser.id,       groupSlug: "berlin"   },
  { userId: hostUser.id,       groupSlug: "cologne"  },
  { userId: hostUser.id,       groupSlug: "frankfurt" },
].filter((m) => m.userId); // skip if user doesn't exist

const existingMemberships = db.select().from(schema.groupMemberships).all();

for (const m of membershipPlan) {
  const alreadyMember = existingMemberships.some(
    (em) => em.userId === m.userId && em.groupId === groupIds[m.groupSlug]
  );
  if (alreadyMember) continue;

  db.insert(schema.groupMemberships).values({
    id: uuid(),
    userId: m.userId,
    groupId: groupIds[m.groupSlug],
    joinedAt: new Date().toISOString(),
  }).run();
}
console.log(`  memberships seeded`);

// ─── representatives ─────────────────────────────────────────────────────────

const repPlan: Array<{ userId: string; groupSlug: string }> = [
  { userId: testUsers[0]?.id,  groupSlug: "berlin"    },
  { userId: testUsers[2]?.id,  groupSlug: "munich"    },
  { userId: testUsers[6]?.id,  groupSlug: "hamburg"   },
  { userId: testUsers[4]?.id,  groupSlug: "frankfurt" },
  { userId: testUsers[8]?.id,  groupSlug: "cologne"   },
  { userId: hostUser.id,       groupSlug: "berlin"    },
].filter((r) => r.userId);

const existingReps = db.select().from(schema.groupRepresentatives).all();

for (const r of repPlan) {
  const alreadyRep = existingReps.some(
    (er) => er.userId === r.userId && er.groupId === groupIds[r.groupSlug]
  );
  if (alreadyRep) continue;

  db.insert(schema.groupRepresentatives).values({
    id: uuid(),
    userId: r.userId,
    groupId: groupIds[r.groupSlug],
    promotedBy: adminUser.id,
    promotedAt: new Date().toISOString(),
  }).run();
}
console.log(`  representatives seeded`);

// ─── posts ───────────────────────────────────────────────────────────────────

const postDefs: Array<{
  title: string;
  body: string;
  groupSlug: string | null;
  visibility: "global" | "group-only";
  authorIdx: number; // index into testUsers, -1 = adminUser, -2 = hostUser
}> = [
  // Berlin posts
  {
    title: "Welcome to the Berlin Group!",
    body: "<p>Hey everyone, great to have you here. This is the official group for all Berlin-based members. Let's stay connected and support each other!</p>",
    groupSlug: "berlin",
    visibility: "global",
    authorIdx: 0,
  },
  {
    title: "Berlin Meetup Recap – Spring Edition",
    body: "<p>What a fantastic evening! We had over 30 people join us at the Kulturbrauerei. Thanks to everyone who came and to our volunteers who made it happen.</p><p>Photos will be up shortly.</p>",
    groupSlug: "berlin",
    visibility: "group-only",
    authorIdx: 0,
  },
  {
    title: "New Members – Introduce Yourself!",
    body: "<p>We've had a wave of new sign-ups recently. Drop a comment below and tell the group a bit about yourself. We'd love to know who you are and what brings you here.</p>",
    groupSlug: "berlin",
    visibility: "group-only",
    authorIdx: 5,
  },

  // Munich posts
  {
    title: "Munich Group – First Update",
    body: "<p>Welcome to Munich! We're just getting started here but we already have some exciting events planned for the coming months. Stay tuned.</p>",
    groupSlug: "munich",
    visibility: "global",
    authorIdx: 2,
  },
  {
    title: "Oktoberfest Community Meetup Planning",
    body: "<p>We're planning a group outing around Oktoberfest season. If you're interested in joining, reply to this post so we can gauge numbers and book a table together.</p>",
    groupSlug: "munich",
    visibility: "group-only",
    authorIdx: 7,
  },

  // Hamburg posts
  {
    title: "Hamburg Is Live!",
    body: "<p>The Hamburg group is now officially open. Whether you're a local or just visiting the city, you're welcome here.</p>",
    groupSlug: "hamburg",
    visibility: "global",
    authorIdx: 6,
  },
  {
    title: "Harbour Walk – Members Only Event",
    body: "<p>We're organising a guided walk along the harbour on Saturday morning. It's free and open exclusively to group members. Details are in the Events section.</p>",
    groupSlug: "hamburg",
    visibility: "group-only",
    authorIdx: 3,
  },

  // Frankfurt posts
  {
    title: "Frankfurt Group Launch",
    body: "<p>Frankfurt is now on the map! We're excited to build a community here. Our first event is coming soon – watch this space.</p>",
    groupSlug: "frankfurt",
    visibility: "global",
    authorIdx: 4,
  },
  {
    title: "Finance & Tech Networking Night",
    body: "<p>Given Frankfurt's unique position as a financial hub, we're hosting a networking evening for members in finance and tech. Bring your business cards!</p>",
    groupSlug: "frankfurt",
    visibility: "group-only",
    authorIdx: 8,
  },

  // Cologne posts
  {
    title: "Cologne Group – Welcome Post",
    body: "<p>We're thrilled to open the Cologne group. This is a space for everyone in the Cologne area to connect, share, and grow together.</p>",
    groupSlug: "cologne",
    visibility: "global",
    authorIdx: -2, // hostUser
  },
  {
    title: "Carnival Pre-Party – Members Only",
    body: "<p>Cologne Carnival is around the corner! We're organising a private pre-party for group members. Limited spots – first come, first served. Check the events page.</p>",
    groupSlug: "cologne",
    visibility: "group-only",
    authorIdx: 3,
  },

  // Global posts (no group)
  {
    title: "Platform Announcement: New Features Live",
    body: "<p>We've just rolled out a set of new features including improved group pages, better event management, and a refreshed profile page. Check them out and let us know what you think!</p>",
    groupSlug: null,
    visibility: "global",
    authorIdx: -1, // adminUser
  },
  {
    title: "Community Guidelines Update",
    body: "<p>Please take a moment to review our updated community guidelines. We've added clearer rules around respectful communication and event promotion. Thank you for helping keep this a great place.</p>",
    groupSlug: null,
    visibility: "global",
    authorIdx: -1,
  },
];

for (const p of postDefs) {
  const authorId =
    p.authorIdx === -1
      ? adminUser.id
      : p.authorIdx === -2
        ? hostUser.id
        : (testUsers[p.authorIdx]?.id ?? adminUser.id);

  db.insert(schema.posts).values({
    id: uuid(),
    title: p.title,
    body: p.body,
    editorState: null,
    userId: authorId,
    groupId: p.groupSlug ? groupIds[p.groupSlug] : null,
    visibility: p.visibility,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).run();
}
console.log(`  posts seeded (${postDefs.length})`);

// ─── events ──────────────────────────────────────────────────────────────────

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
  // Berlin events
  {
    title: "Berlin Summer Social",
    body: "<p>Join us for our annual summer social in Görlitzer Park. Bring a blanket, some snacks, and your best summer vibes. This is a free, informal gathering for all Berlin members.</p>",
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
    body: "<p>A members-only evening of short talks on the latest in AI and machine learning. Three speakers from our own community will present for 20 minutes each, followed by an open Q&A and networking.</p>",
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
    body: "<p>Just joined? Come along to our relaxed welcome night at a local bar. It's a great chance to put faces to names and start making connections in the Berlin community.</p>",
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

  // Munich events
  {
    title: "Munich Community Hike – Englischer Garten",
    body: "<p>Let's explore the Englischer Garten together! We'll meet at the Chinesischer Turm and walk for about 2 hours. All fitness levels welcome.</p>",
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
    body: "<p>A practical, low-pressure workshop on public speaking for members. We'll do short exercises and give each other constructive feedback. Space is limited to 15 people.</p>",
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

  // Hamburg events
  {
    title: "Hamburg Harbour Morning Walk",
    body: "<p>Start your Saturday right with a 90-minute guided walk along the Hamburg harbour. We'll stop at key landmarks and finish with coffee at a local café.</p>",
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
    body: "<p>An open-door meetup for everyone in Hamburg and visitors to the city. Come as you are – there's no agenda, just great people and good conversation.</p>",
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

  // Frankfurt events
  {
    title: "Frankfurt Networking Breakfast",
    body: "<p>An early morning networking session over coffee and pastries. Perfect for professionals who want to connect before the working day. Hosted exclusively for Frankfurt group members.</p>",
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
    body: "<p>Five members of our community will pitch their startup ideas to the group. Attendees will vote for their favourite. A great evening of inspiration and creativity.</p>",
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

  // Cologne events
  {
    title: "Cologne Members Dinner",
    body: "<p>A sit-down dinner for Cologne group members. We've booked out a private dining room at a local restaurant. Tickets cover a three-course meal; drinks are pay-as-you-go.</p>",
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
    body: "<p>Come and meet the Cologne community! This is an open event – bring a friend. We'll be in the beer garden by the Rhine for an evening of good company.</p>",
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

  // Global events
  {
    title: "All-Groups Online Town Hall",
    body: "<p>Quarterly online town hall open to members of all groups. The platform team will share updates, answer questions, and discuss upcoming features. Link will be sent to all registered users before the event.</p>",
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
];

for (const e of eventDefs) {
  const authorId =
    e.authorIdx === -1
      ? adminUser.id
      : e.authorIdx === -2
        ? hostUser.id
        : (testUsers[e.authorIdx]?.id ?? adminUser.id);

  const start = daysFromNow(e.startOffsetDays);
  const end = new Date(new Date(start).getTime() + e.durationHours * 3600000).toISOString();

  db.insert(schema.events).values({
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
    userId: authorId,
    groupId: e.groupSlug ? groupIds[e.groupSlug] : null,
    visibility: e.visibility,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).run();
}
console.log(`  events seeded (${eventDefs.length})`);

// ─── summary ─────────────────────────────────────────────────────────────────

const counts = {
  groups:      db.select().from(schema.groups).all().length,
  memberships: db.select().from(schema.groupMemberships).all().length,
  reps:        db.select().from(schema.groupRepresentatives).all().length,
  posts:       db.select().from(schema.posts).all().length,
  events:      db.select().from(schema.events).all().length,
};

console.log("\n✅ Seed complete:");
console.log(`   groups:      ${counts.groups}`);
console.log(`   memberships: ${counts.memberships}`);
console.log(`   reps:        ${counts.reps}`);
console.log(`   posts:       ${counts.posts}`);
console.log(`   events:      ${counts.events}`);

sqlite.close();

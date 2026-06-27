/**
 * Shared Playwright fixtures and DB helpers.
 *
 * Fixtures:
 *  - `guestPage`     – unauthenticated page (no session cookie)
 *  - `memberPage`    – authenticated as a regular user  (role: "user")
 *  - `moderatorPage` – authenticated as a moderator     (role: "moderator")
 *  - `adminPage`     – authenticated as an admin        (role: "admin")
 *
 * Each authenticated fixture creates a temporary user+login+session in the DB
 * and removes all three rows automatically after the test.
 */

import { test as base, type BrowserContext, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { execSync } from "child_process";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = process.env.DB_PATH ?? path.join(ROOT, "my-database.db");

// ── DB helpers ────────────────────────────────────────────────────────────────

export function openDb() {
  const db = new Database(DB_PATH);
  // Mirror the app's connection (src/db/connection.ts): wait on a held lock
  // instead of erroring immediately. Tests open many short-lived connections
  // that contend with the dev server's writer; without this they fail with
  // "database is locked" / "locking protocol" under load.
  db.pragma("busy_timeout = 5000");
  return db;
}

/** Insert a session for the given userId, return the token and sessionId. */
export function createDbSession(userId: string): {
  sessionId: string;
  sessionToken: string;
} {
  const db = openDb();
  const sessionToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const sessionId = crypto.randomUUID();

  db.prepare(
    "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
  ).run(sessionId, userId, sessionToken, expiresAt);

  db.close();
  return { sessionId, sessionToken };
}

/** Delete a session by id. */
export function deleteDbSession(sessionId: string) {
  const db = openDb();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  db.close();
}

/** Delete a page by slug (for test cleanup). */
export function deletePageBySlug(slug: string) {
  const db = openDb();
  db.prepare("DELETE FROM pages WHERE slug = ?").run(slug);
  db.close();
}

/** Get a page row by slug. */
export function getPageBySlug(
  slug: string,
): { id: string; title: string; status: string } | undefined {
  const db = openDb();
  const row = db
    .prepare("SELECT id, title, status FROM pages WHERE slug = ? LIMIT 1")
    .get(slug) as { id: string; title: string; status: string } | undefined;
  db.close();
  return row;
}

// ── Auth session helpers ──────────────────────────────────────────────────────

export type UserRole = "user" | "moderator" | "admin";

export interface CreatedSession {
  userId: string;
  sessionToken: string;
  cleanup(): void;
}

/**
 * Delete all rows that reference the given userId (and the login row identified
 * by loginId) in the correct FK-safe order, then delete the user itself.
 * This prevents "FOREIGN KEY constraint failed" errors during test cleanup.
 */
function deleteUserCascade(
  db: ReturnType<typeof openDb>,
  userId: string,
  loginId: string,
): void {
  // Child rows of events owned by this user (no cascade on transactions/tickets)
  db.prepare(
    "DELETE FROM tickets WHERE event_id IN (SELECT id FROM events WHERE user_id = ?)",
  ).run(userId);
  db.prepare(
    "DELETE FROM transactions WHERE event_id IN (SELECT id FROM events WHERE user_id = ?)",
  ).run(userId);
  // Events (CASCADE: inventory_groups, products, participation_status, event_photos)
  db.prepare("DELETE FROM events WHERE user_id = ?").run(userId);
  // Tickets/transactions owned by the user (from their own purchases)
  db.prepare(
    "DELETE FROM tickets WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ?)",
  ).run(userId);
  db.prepare("DELETE FROM transactions WHERE user_id = ?").run(userId);
  // Group membership and representatives
  db.prepare("DELETE FROM group_representatives WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM group_memberships WHERE user_id = ?").run(userId);
  // Misc user-linked data
  db.prepare("DELETE FROM form_results WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM participation_status WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM posts WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM jobs WHERE suggested_by = ?").run(userId);
  // New feature tables
  db.prepare("DELETE FROM election_applications WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM user_qualifications WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(userId);
  // Sessions and user/login rows
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  db.prepare("DELETE FROM logins WHERE id = ?").run(loginId);
}

/**
 * Create a temporary user + login + session row in the DB.
 * Call `cleanup()` to remove all three rows after the test.
 */
export function createUserSession(role: UserRole, prefix = "e2e"): CreatedSession {
  const db = openDb();
  const userId = crypto.randomUUID();
  const loginId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const email = `${prefix}-${role}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}@example.com`;
  const sessionToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

  const now = new Date().toISOString();
  const consent = JSON.stringify({ lastProfileUpdate: now, locationVerification: now, foodPreference: now, photoConsent: now });

  db.prepare("INSERT INTO logins (id, email, expires_at) VALUES (?, ?, ?)").run(
    loginId, email, expiresAt,
  );
  db.prepare(
    "INSERT INTO users (id, name, family_name, login_id, role, consent, food_preference, photo_consent_given) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(userId, "Test", "User", loginId, role, consent, "none", 1);
  db.prepare(
    "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
  ).run(sessionId, userId, sessionToken, expiresAt);
  db.close();

  return {
    userId,
    sessionToken,
    cleanup() {
      const db2 = openDb();
      deleteUserCascade(db2, userId, loginId);
      db2.close();
    },
  };
}

// ── User helpers ─────────────────────────────────────────────────────────────

export function getUserById(id: string): Record<string, unknown> | undefined {
  const db = openDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  db.close();
  return row;
}

/** Return the user id for the given login email, or undefined if not found. */
export function getUserIdByEmail(email: string): string | undefined {
  const db = openDb();
  const login = db.prepare("SELECT id FROM logins WHERE email = ?").get(email) as { id: string } | undefined;
  if (!login) { db.close(); return undefined; }
  const user = db.prepare("SELECT id FROM users WHERE login_id = ?").get(login.id) as { id: string } | undefined;
  db.close();
  return user?.id;
}

/** Delete the user and login rows associated with a given login email (mailpit test cleanup). */
export function deleteUserByEmail(email: string): void {
  const db = openDb();
  const login = db.prepare("SELECT id FROM logins WHERE email = ?").get(email) as
    | { id: string }
    | undefined;
  if (login) {
    const user = db
      .prepare("SELECT id FROM users WHERE login_id = ?")
      .get(login.id) as { id: string } | undefined;
    if (user) {
      deleteUserCascade(db, user.id, login.id);
    } else {
      db.prepare("DELETE FROM logins WHERE id = ?").run(login.id);
    }
  }
  db.close();
}

/** Update the consent JSON for the user identified by their login email. */
export function setUserConsentByEmail(
  email: string,
  consent: Record<string, string>,
): void {
  const db = openDb();
  const login = db.prepare("SELECT id FROM logins WHERE email = ?").get(email) as
    | { id: string }
    | undefined;
  if (!login) {
    db.close();
    return;
  }
  const user = db
    .prepare("SELECT id FROM users WHERE login_id = ?")
    .get(login.id) as { id: string } | undefined;
  if (!user) {
    db.close();
    return;
  }
  db.prepare("UPDATE users SET consent = ? WHERE id = ?").run(
    JSON.stringify(consent),
    user.id,
  );
  db.close();
}

/** Create a user with specific consent/food/photo fields (for profile-setup tests). */
export function createTestUser(opts: {
  consent: Record<string, string>;
  foodPreference?: string | null;
  photoConsentGiven?: boolean | null;
}): CreatedSession {
  const session = createUserSession("user");
  const db = openDb();
  db.prepare(
    "UPDATE users SET consent = ?, food_preference = ?, photo_consent_given = ? WHERE id = ?",
  ).run(
    JSON.stringify(opts.consent),
    opts.foodPreference ?? null,
    opts.photoConsentGiven == null ? null : opts.photoConsentGiven ? 1 : 0,
    session.userId,
  );
  db.close();
  return session;
}

// ── Group helpers ─────────────────────────────────────────────────────────────

export function getGroupBySlug(
  slug: string,
): { id: string; name: string; slug: string } | undefined {
  const db = openDb();
  const row = db
    .prepare("SELECT id, name, slug FROM groups WHERE slug = ? LIMIT 1")
    .get(slug) as { id: string; name: string; slug: string } | undefined;
  db.close();
  return row;
}

/** Add a user to a group. Returns the new membership id. */
export function addGroupMember(userId: string, groupId: string): string {
  const db = openDb();
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT OR IGNORE INTO group_memberships (id, user_id, group_id) VALUES (?, ?, ?)",
  ).run(id, userId, groupId);
  db.close();
  return id;
}

export function deleteGroupMember(userId: string, groupId: string): void {
  const db = openDb();
  db.prepare(
    "DELETE FROM group_memberships WHERE user_id = ? AND group_id = ?",
  ).run(userId, groupId);
  db.close();
}

export function deleteGroupRepresentative(userId: string, groupId: string): void {
  const db = openDb();
  db.prepare(
    "DELETE FROM group_representatives WHERE user_id = ? AND group_id = ?",
  ).run(userId, groupId);
  db.close();
}

// ── Event helpers ─────────────────────────────────────────────────────────────

/** Create a minimal event with one paid product (for consent/checkout tests). */
export function createTestEvent(userId: string): { eventId: string; cleanup(): void } {
  const db = openDb();
  const eventId = crypto.randomUUID();
  const inventoryGroupId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const start = new Date(Date.now() + 14 * 86400000).toISOString();
  const end = new Date(Date.now() + 14 * 86400000 + 7200000).toISOString();

  db.prepare(
    `INSERT INTO events (id, title, body, start_date, end_date, location_type, user_id, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(eventId, "Consent Test Event", "<p>test</p>", start, end, "online", userId, "global");
  db.prepare(
    `INSERT INTO inventory_groups (id, event_id, name, max_capacity, needs_ticket)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(inventoryGroupId, eventId, "General", 100, 1);
  db.prepare(
    `INSERT INTO products (id, event_id, inventory_group_id, name, price, max_quantity, participant_capacity, features)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(productId, eventId, inventoryGroupId, "Standard", 10.0, 1, 1, "[]");
  db.close();

  return {
    eventId,
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM products WHERE id = ?").run(productId);
      db2.prepare("DELETE FROM inventory_groups WHERE id = ?").run(inventoryGroupId);
      db2.prepare("DELETE FROM events WHERE id = ?").run(eventId);
      db2.close();
    },
  };
}

// ── Ticket helpers ────────────────────────────────────────────────────────────

/** Get the login email for a user by their user id. */
export function getUserEmailById(userId: string): string | null {
  const db = openDb();
  const user = db.prepare("SELECT login_id FROM users WHERE id = ?").get(userId) as
    | { login_id: string | null }
    | undefined;
  if (!user?.login_id) { db.close(); return null; }
  const login = db.prepare("SELECT email FROM logins WHERE id = ?").get(user.login_id) as
    | { email: string }
    | undefined;
  db.close();
  return login?.email ?? null;
}

/**
 * Create an event + product and return their IDs. Caller is responsible for
 * cleanup (delete products → inventory_groups → events in that order).
 */
export function createTestEventWithProduct(opts: {
  ownerId: string;
  isFuture?: boolean;
  participantCapacity?: number;
  title?: string;
}): { eventId: string; productId: string; cleanup(): void } {
  const db = openDb();
  const eventId = crypto.randomUUID();
  const inventoryGroupId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const offset = (opts.isFuture !== false ? 7 : -7) * 86400000;
  const start = new Date(Date.now() + offset).toISOString();
  const end = new Date(Date.now() + offset + 7200000).toISOString();

  db.prepare(
    `INSERT INTO events (id, title, body, start_date, end_date, location_type, user_id, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(eventId, opts.title ?? "Ticket Test Event", "<p>test</p>", start, end, "online", opts.ownerId, "global");
  db.prepare(
    `INSERT INTO inventory_groups (id, event_id, name, max_capacity, needs_ticket)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(inventoryGroupId, eventId, "General", 100, 1);
  db.prepare(
    `INSERT INTO products (id, event_id, inventory_group_id, name, price, max_quantity, participant_capacity, features)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(productId, eventId, inventoryGroupId, "Standard Ticket", 0, 10, opts.participantCapacity ?? 1, "[]");
  db.close();

  return {
    eventId,
    productId,
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM ticket_participants WHERE ticket_id IN (SELECT id FROM tickets WHERE event_id = ?)").run(eventId);
      db2.prepare("DELETE FROM tickets WHERE event_id = ?").run(eventId);
      db2.prepare("DELETE FROM transactions WHERE event_id = ?").run(eventId);
      db2.prepare("DELETE FROM products WHERE event_id = ?").run(eventId);
      db2.prepare("DELETE FROM inventory_groups WHERE event_id = ?").run(eventId);
      db2.prepare("DELETE FROM events WHERE id = ?").run(eventId);
      db2.close();
    },
  };
}

/**
 * Insert a transaction + ticket row for an existing event/product.
 * Returns the ticketId.
 */
export function createTicketInDb(opts: {
  buyerId: string;
  eventId: string;
  productId: string;
}): string {
  const db = openDb();
  const transactionId = crypto.randomUUID();
  const ticketId = crypto.randomUUID();
  const qrCodeUuid = crypto.randomUUID();
  db.prepare(
    `INSERT INTO transactions (id, user_id, event_id, total_amount, transaction_fee, stripe_session_id, stripe_payment_id)
     VALUES (?, ?, ?, 0, 0, ?, ?)`,
  ).run(transactionId, opts.buyerId, opts.eventId, `free_${crypto.randomUUID()}`, `free_${crypto.randomUUID()}`);
  db.prepare(
    `INSERT INTO tickets (id, qr_code_uuid, transaction_id, product_id, event_id, buyer_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(ticketId, qrCodeUuid, transactionId, opts.productId, opts.eventId, opts.buyerId);
  db.close();
  return ticketId;
}

/** Add a participant row to an existing ticket. */
export function addParticipantToTicket(
  ticketId: string,
  opts: { name: string; email: string; order?: number; userId?: string },
): void {
  const db = openDb();
  db.prepare(
    `INSERT INTO ticket_participants (id, ticket_id, participant_order, name, email, user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), ticketId, opts.order ?? 1, opts.name, opts.email, opts.userId ?? null);
  db.close();
}

// ── Job helpers ───────────────────────────────────────────────────────────────

export function createJobInDb(opts: {
  suggestedBy: string;
  title?: string;
  status?: "pending" | "approved";
  expiresAt?: string;
}): { jobId: string; cleanup(): void } {
  const db = openDb();
  const jobId = crypto.randomUUID();
  const expiresAt =
    opts.expiresAt ?? new Date(Date.now() + 30 * 86400000).toISOString();
  db.prepare(
    `INSERT INTO jobs (id, title, body, location_type, expires_at, status, suggested_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    jobId,
    opts.title ?? "Test Job",
    "<p>test body</p>",
    "on-site",
    expiresAt,
    opts.status ?? "pending",
    opts.suggestedBy,
  );
  db.close();

  return {
    jobId,
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);
      db2.close();
    },
  };
}

export function getJobById(
  id: string,
): { id: string; title: string; status: string; suggested_by: string } | undefined {
  const db = openDb();
  const row = db
    .prepare("SELECT id, title, status, suggested_by FROM jobs WHERE id = ? LIMIT 1")
    .get(id) as
    | { id: string; title: string; status: string; suggested_by: string }
    | undefined;
  db.close();
  return row;
}

export function deleteJobById(id: string): void {
  const db = openDb();
  db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  db.close();
}

// ── Post helpers ──────────────────────────────────────────────────────────────

export function getPostByTitle(
  title: string,
): { id: string; title: string; featured_image: string | null } | null {
  const db = openDb();
  const row = db
    .prepare(
      "SELECT id, title, featured_image FROM posts WHERE title = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(title) as
    | { id: string; title: string; featured_image: string | null }
    | undefined;
  db.close();
  return row ?? null;
}

export function deletePostByTitle(title: string): void {
  const db = openDb();
  db.prepare("DELETE FROM posts WHERE title = ?").run(title);
  db.close();
}

// ── Page / menu helpers ───────────────────────────────────────────────────────

export function createPageInDb(opts: {
  title: string;
  url: string;
  menuName: "main" | "footer";
  status: "draft" | "published";
}): { pageId: string; menuItemId: string } {
  const db = openDb();
  const pageId = crypto.randomUUID();
  const menuItemId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO pages (id, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(pageId, JSON.stringify([]), opts.status, now, now);

  const maxPosRow = db
    .prepare("SELECT MAX(position) as pos FROM menu_items WHERE menu_name = ?")
    .get(opts.menuName) as { pos: number | null } | undefined;
  const position = (maxPosRow?.pos ?? 0) + 1;

  db.prepare(
    "INSERT INTO menu_items (id, menu_name, title, url, page_id, parent_id, position, status, icon, target, created_at, updated_at) VALUES (?, ?, ?, ?, ?, null, ?, 'hidden', null, '_self', ?, ?)",
  ).run(menuItemId, opts.menuName, opts.title, opts.url, pageId, position, now, now);

  db.close();
  return { pageId, menuItemId };
}

export function createMenuItemInDb(opts: {
  menuName: "main" | "footer";
  title: string;
  url: string;
  position: number;
  status?: "visible" | "hidden";
}): string {
  const db = openDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO menu_items (id, menu_name, title, url, page_id, parent_id, position, status, icon, target, created_at, updated_at) VALUES (?, ?, ?, ?, null, null, ?, ?, null, '_self', ?, ?)",
  ).run(id, opts.menuName, opts.title, opts.url, opts.position, opts.status ?? "visible", now, now);
  db.close();
  return id;
}

/** Delete a page and all its linked menu items. */
export function deletePageAndMenuItems(pageId: string): void {
  const db = openDb();
  db.prepare("DELETE FROM menu_items WHERE page_id = ?").run(pageId);
  db.prepare("DELETE FROM pages WHERE id = ?").run(pageId);
  db.close();
}

export function deleteMenuItemById(id: string): void {
  const db = openDb();
  db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
  db.close();
}

export function getMenuItemByUrl(
  url: string,
): { id: string; title: string; url: string; status: string } | undefined {
  const db = openDb();
  const row = db
    .prepare("SELECT id, title, url, status FROM menu_items WHERE url = ? LIMIT 1")
    .get(url) as { id: string; title: string; url: string; status: string } | undefined;
  db.close();
  return row;
}

export function getMenuItemPosition(id: string): number | null {
  const db = openDb();
  const row = db.prepare("SELECT position FROM menu_items WHERE id = ?").get(id) as
    | { position: number }
    | undefined;
  db.close();
  return row?.position ?? null;
}

export function getPageContent(pageId: string): Array<Record<string, unknown>> {
  const db = openDb();
  const row = db.prepare("SELECT content FROM pages WHERE id = ?").get(pageId) as
    | { content: string }
    | undefined;
  db.close();
  if (!row?.content) return [];
  try {
    return JSON.parse(row.content) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function injectSessionCookie(context: BrowserContext, token: string) {
  await context.addCookies([
    {
      name: "session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
    },
  ]);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

type DbHelper = {
  getEventIdByTitle: (title: string) => string | null;
  getProductsByEventId: (eventId: string) => unknown[];
  getInventoryGroupsByEventId: (eventId: string) => unknown[];
  getTicketCountByEventId: (eventId: string) => number;
  getTicketCountByEventIdAndEmail: (eventId: string, email: string) => number;
  getTicketCountByEventIdAndUserId: (eventId: string, userId: string) => number;
  getParticipationStatusByEventIdAndUserId: (eventId: string, userId: string) => string | null;
  getProductSoldQuantityById: (productId: string) => number;
};

type Fixtures = {
  /** Unauthenticated browser page (no session cookie). */
  guestPage: Page;
  /** Browser page authenticated as a regular user (role: "user"). */
  memberPage: Page;
  /** Browser page authenticated as a moderator (role: "moderator"). */
  moderatorPage: Page;
  /** Browser page authenticated as an admin (role: "admin"). */
  adminPage: Page;
  /** Runs the seed script before the test (requires E2E_ALLOW_DB_WRITE=true). */
  dbSeed: null;
  /** DB query helpers for events and products. */
  db: DbHelper;
};

export const test = base.extend<Fixtures>({
  guestPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  memberPage: async ({ browser }, use) => {
    const session = createUserSession("user");
    const context = await browser.newContext();
    await injectSessionCookie(context, session.sessionToken);
    const page = await context.newPage();
    await use(page);
    await context.close();
    session.cleanup();
  },

  moderatorPage: async ({ browser }, use) => {
    const session = createUserSession("moderator");
    const context = await browser.newContext();
    await injectSessionCookie(context, session.sessionToken);
    const page = await context.newPage();
    await use(page);
    await context.close();
    session.cleanup();
  },

  adminPage: async ({ browser }, use) => {
    const session = createUserSession("admin");
    const context = await browser.newContext();
    await injectSessionCookie(context, session.sessionToken);
    const page = await context.newPage();
    await use(page);
    await context.close();
    session.cleanup();
  },

  dbSeed: [
    async ({}, use) => {
      const allow = process.env.E2E_ALLOW_DB_WRITE;
      if (!(allow === "true" || allow === "1")) {
        throw new Error(
          'E2E_ALLOW_DB_WRITE must be set to "true" or "1" to run e2e fixtures',
        );
      }
      execSync("node ./scripts/run-seed.js", { stdio: "inherit" });
      await use(null);
    },
    { auto: false },
  ],

  db: async ({}, use) => {
    const sqlite = openDb();
    const helper: DbHelper = {
      getEventIdByTitle(title) {
        const row = sqlite
          .prepare(
            "SELECT id FROM events WHERE title = ? ORDER BY created_at DESC LIMIT 1",
          )
          .get(title) as { id: string } | undefined;
        return row ? row.id : null;
      },
      getProductsByEventId(eventId) {
        return sqlite.prepare("SELECT * FROM products WHERE event_id = ?").all(eventId);
      },
      getInventoryGroupsByEventId(eventId) {
        return sqlite
          .prepare("SELECT * FROM inventory_groups WHERE event_id = ?")
          .all(eventId);
      },
      getTicketCountByEventId(eventId) {
        const row = sqlite.prepare(
          `SELECT COUNT(*) AS count
           FROM tickets
           WHERE event_id = ?`,
        ).get(eventId) as { count: number };
        return row.count;
      },
      getTicketCountByEventIdAndEmail(eventId, email) {
        const row = sqlite.prepare(
          `SELECT COUNT(*) AS count
           FROM tickets
           WHERE event_id = ?
             AND buyer_id = (
               SELECT users.id
               FROM users
               INNER JOIN logins ON logins.id = users.login_id
               WHERE logins.email = ?
               LIMIT 1
             )`,
        ).get(eventId, email) as { count: number };
        return row.count;
      },
      getTicketCountByEventIdAndUserId(eventId, userId) {
        const row = sqlite.prepare(
          `SELECT COUNT(*) AS count
           FROM tickets
           WHERE event_id = ? AND buyer_id = ?`,
        ).get(eventId, userId) as { count: number };
        return row.count;
      },
      getParticipationStatusByEventIdAndUserId(eventId, userId) {
        const row = sqlite.prepare(
          `SELECT status
           FROM participation_status
           WHERE event_id = ? AND user_id = ?
           LIMIT 1`,
        ).get(eventId, userId) as { status: string } | undefined;
        return row?.status ?? null;
      },
      getProductSoldQuantityById(productId) {
        const row = sqlite.prepare(
          `SELECT sold_quantity
           FROM products
           WHERE id = ?
           LIMIT 1`,
        ).get(productId) as { sold_quantity: number } | undefined;
        return row?.sold_quantity ?? 0;
      },
    };
    await use(helper);
    sqlite.close();
  },
});

export { expect } from "@playwright/test";

/** Email used by the shared pre-authenticated session created in auth.setup.ts. */
export const SHARED_E2E_EMAIL = "e2e-shared@example.com";

// ── New feature DB helpers ─────────────────────────────────────────────────

export function createQualificationTypeInDb(
  overrides: Record<string, unknown> = {},
): { typeId: string; cleanup: () => void } {
  const db = openDb();
  const typeId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO qualification_types (id, slug, label, grants_membership_tier, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    typeId,
    (overrides.slug as string) ?? `e2e-type-${typeId.slice(0, 8)}`,
    (overrides.label as string) ?? "E2E Test Type",
    (overrides.grantsMembershipTier as string) ?? "associated",
    new Date().toISOString(),
    new Date().toISOString(),
  );
  db.close();
  return {
    typeId,
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM user_qualifications WHERE type_id = ?").run(typeId);
      db2.prepare("DELETE FROM qualification_types WHERE id = ?").run(typeId);
      db2.close();
    },
  };
}

export function createQualificationInDb(
  userId: string,
  typeId: string,
  status: "pending" | "approved" | "rejected" = "pending",
): { qualId: string; cleanup: () => void } {
  const db = openDb();
  const qualId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO user_qualifications (id, user_id, type_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(qualId, userId, typeId, status, new Date().toISOString(), new Date().toISOString());
  db.close();
  return {
    qualId,
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM user_qualifications WHERE id = ?").run(qualId);
      db2.close();
    },
  };
}

export function createMembershipInDb(
  userId: string,
  tier: "associated" | "full",
): { membershipId: string; cleanup: () => void } {
  const db = openDb();
  const membershipId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO user_memberships (id, user_id, tier, granted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(membershipId, userId, tier, new Date().toISOString(), new Date().toISOString(), new Date().toISOString());
  db.close();
  return {
    membershipId,
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM user_memberships WHERE id = ?").run(membershipId);
      db2.close();
    },
  };
}

export function createUserSessionWithMembership(
  tier: "associated" | "full",
): CreatedSession & { membershipId: string } {
  const session = createUserSession("user");
  const { membershipId } = createMembershipInDb(session.userId, tier);
  const originalCleanup = session.cleanup.bind(session);
  return {
    ...session,
    membershipId,
    cleanup() {
      const db = openDb();
      db.prepare("DELETE FROM user_memberships WHERE id = ?").run(membershipId);
      db.close();
      originalCleanup();
    },
  };
}

export function createElectionCycleInDb(
  overrides: Record<string, unknown> = {},
): { cycleId: string; cleanup: () => void } {
  const db = openDb();
  const cycleId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO election_cycles (id, title, year, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    cycleId,
    (overrides.title as string) ?? "E2E Test Elections",
    (overrides.year as number) ?? 2026,
    (overrides.status as string) ?? "draft",
    new Date().toISOString(),
    new Date().toISOString(),
  );
  db.close();
  return {
    cycleId,
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM election_applications WHERE cycle_id = ?").run(cycleId);
      db2.prepare("DELETE FROM election_positions WHERE cycle_id = ?").run(cycleId);
      db2.prepare("DELETE FROM election_cycles WHERE id = ?").run(cycleId);
      db2.close();
    },
  };
}

export function createElectionPositionInDb(
  cycleId: string,
  overrides: Record<string, unknown> = {},
): { positionId: string; cleanup: () => void } {
  const db = openDb();
  const positionId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO election_positions (id, cycle_id, title, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(
    positionId,
    cycleId,
    (overrides.title as string) ?? "E2E Position",
    new Date().toISOString(),
  );
  db.close();
  return {
    positionId,
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM election_applications WHERE position_id = ?").run(positionId);
      db2.prepare("DELETE FROM election_positions WHERE id = ?").run(positionId);
      db2.close();
    },
  };
}

export function createElectionApplicationInDb(
  positionId: string,
  cycleId: string,
  userId: string,
  status: "pending" | "approved" | "rejected" = "pending",
  adminNote?: string,
): { appId: string; cleanup: () => void } {
  const db = openDb();
  const appId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO election_applications
       (id, position_id, cycle_id, user_id, status, admin_note, motivation_why, motivation_experience, motivation_goals, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    appId, positionId, cycleId, userId, status, adminNote ?? null,
    "Why reason", "Experience text", "Goals text",
    new Date().toISOString(), new Date().toISOString(),
  );
  db.close();
  return {
    appId,
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM election_applications WHERE id = ?").run(appId);
      db2.close();
    },
  };
}

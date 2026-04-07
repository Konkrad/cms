/**
 * Shared Playwright fixtures.
 *
 * `adminPage`  – a Page already authenticated as the Konrad admin user.
 *               The session is created directly in the DB before the test
 *               and cleaned up automatically after.
 */

import { test as base, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = process.env.DB_PATH ?? path.join(ROOT, "my-database.db");

// ── helpers ──────────────────────────────────────────────────────────────────

export function openDb() {
  return new Database(DB_PATH);
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

// ── fixtures ──────────────────────────────────────────────────────────────────

type Fixtures = {
  adminPage: Page;
};

export const test = base.extend<Fixtures>({
  adminPage: async ({ browser }, use) => {
    // Look up admin user
    const db = openDb();
    const admin = db
      .prepare(
        "SELECT id FROM users WHERE role = 'admin' AND name = 'Konrad' LIMIT 1",
      )
      .get() as { id: string } | undefined;
    db.close();

    if (!admin) throw new Error("Admin user 'Konrad' not found in DB");

    const { sessionId, sessionToken } = createDbSession(admin.id);

    const context = await browser.newContext();
    await context.addCookies([
      {
        name: "session",
        value: sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Strict",
      },
    ]);

    const page = await context.newPage();

    await use(page);

    await context.close();
    deleteDbSession(sessionId);
  },
});

export { expect } from "@playwright/test";

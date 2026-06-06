/**
 * Shared helpers for unit/integration tests.
 * Every helper creates rows directly via better-sqlite3 and returns
 * a cleanup() function — call it in afterEach / afterAll.
 */

import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function getDbPath(): string {
  return process.env.DB_PATH ?? path.join(ROOT, "my-database.db");
}

export function openDb() {
  return new Database(getDbPath());
}

/** Insert a minimal user row. Returns userId and a cleanup fn. */
export function createTestUser(overrides: Record<string, unknown> = {}): {
  userId: string;
  loginId: string;
  cleanup: () => void;
} {
  const db = openDb();
  const userId = crypto.randomUUID();
  const loginId = crypto.randomUUID();
  const email = `test-${userId}@example.com`;

  db.prepare(
    "INSERT INTO logins (id, email, expires_at) VALUES (?, ?, ?)",
  ).run(loginId, email, new Date(Date.now() + 3600000).toISOString());

  db.prepare(
    `INSERT INTO users (id, name, family_name, login_id, consent)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    userId,
    (overrides.name as string) ?? "Test",
    (overrides.familyName as string) ?? "User",
    loginId,
    "{}",
  );

  db.close();

  return {
    userId,
    loginId,
    cleanup() {
      const db2 = openDb();
      // Delete FK children before user row
      db2.prepare("DELETE FROM election_applications WHERE user_id = ?").run(userId);
      db2.prepare("DELETE FROM user_qualifications WHERE user_id = ?").run(userId);
      db2.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(userId);
      db2.prepare("DELETE FROM user_tags WHERE user_id = ?").run(userId);
      db2.prepare("DELETE FROM participation_status WHERE user_id = ?").run(userId);
      db2.prepare("DELETE FROM jobs WHERE suggested_by = ?").run(userId);
      // Events owned by user (participation_status cascades from event deletion)
      db2.prepare("DELETE FROM tickets WHERE event_id IN (SELECT id FROM events WHERE user_id = ?)").run(userId);
      db2.prepare("DELETE FROM transactions WHERE event_id IN (SELECT id FROM events WHERE user_id = ?)").run(userId);
      db2.prepare("DELETE FROM events WHERE user_id = ?").run(userId);
      db2.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
      db2.prepare("DELETE FROM users WHERE id = ?").run(userId);
      db2.prepare("DELETE FROM logins WHERE id = ?").run(loginId);
      db2.close();
    },
  };
}

// ── New feature helpers ─────────────────────────────────────────────────────

export function createTestQualificationType(
  overrides: Record<string, unknown> = {},
): { typeId: string; cleanup: () => void } {
  const db = openDb();
  const typeId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO qualification_types (id, slug, label, grants_membership_tier, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    typeId,
    (overrides.slug as string) ?? `test-type-${typeId.slice(0, 8)}`,
    (overrides.label as string) ?? "Test Type",
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

export function createTestQualification(
  userId: string,
  typeId: string,
  overrides: Record<string, unknown> = {},
): { qualId: string; cleanup: () => void } {
  const db = openDb();
  const qualId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO user_qualifications (id, user_id, type_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    qualId,
    userId,
    typeId,
    (overrides.status as string) ?? "pending",
    new Date().toISOString(),
    new Date().toISOString(),
  );
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

export function createTestMembership(
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

export function createTestTag(
  userId: string,
  slug: string,
  overrides: Record<string, unknown> = {},
): { tagId: string; cleanup: () => void } {
  const db = openDb();
  const tagId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO user_tags (id, user_id, slug, label, category, source_type, granted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    tagId,
    userId,
    slug,
    (overrides.label as string) ?? "Test Tag",
    (overrides.category as string) ?? "custom",
    (overrides.sourceType as string) ?? "manual",
    new Date().toISOString(),
  );
  db.close();
  return {
    tagId,
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM user_tags WHERE id = ?").run(tagId);
      db2.close();
    },
  };
}

export function createTestElectionCycle(
  overrides: Record<string, unknown> = {},
): { cycleId: string; cleanup: () => void } {
  const db = openDb();
  const cycleId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO election_cycles (id, title, year, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    cycleId,
    (overrides.title as string) ?? "Test Elections",
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

export function createTestElectionPosition(
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
    (overrides.title as string) ?? "Board Member",
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

export function createTestElectionApplication(
  positionId: string,
  cycleId: string,
  userId: string,
  status: "pending" | "approved" | "rejected" = "pending",
): { appId: string; cleanup: () => void } {
  const db = openDb();
  const appId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO election_applications
       (id, position_id, cycle_id, user_id, status, motivation_why, motivation_experience, motivation_goals, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    appId,
    positionId,
    cycleId,
    userId,
    status,
    "Because I care",
    "I have experience",
    "To improve things",
    new Date().toISOString(),
    new Date().toISOString(),
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

export function createTestEvent(
  userId: string,
  overrides: Record<string, unknown> = {},
): { eventId: string; cleanup: () => void } {
  const db = openDb();
  const eventId = crypto.randomUUID();
  const pastDate = new Date(Date.now() - 7 * 86400000).toISOString();
  const pastEnd = new Date(Date.now() - 6 * 86400000).toISOString();
  db.prepare(
    `INSERT INTO events (id, title, body, start_date, end_date, location_type, user_id, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    eventId,
    (overrides.title as string) ?? "Test Event",
    "<p>Test</p>",
    (overrides.startDate as string) ?? pastDate,
    (overrides.endDate as string) ?? pastEnd,
    (overrides.locationType as string) ?? "in-person",
    userId,
    (overrides.visibility as string) ?? "global",
    new Date().toISOString(),
    new Date().toISOString(),
  );
  db.close();
  return {
    eventId,
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM participation_status WHERE event_id = ?").run(eventId);
      db2.prepare("DELETE FROM events WHERE id = ?").run(eventId);
      db2.close();
    },
  };
}

export function createTestParticipation(
  userId: string,
  eventId: string,
  status: "yes" | "no" | "maybe" = "yes",
): { cleanup: () => void } {
  const db = openDb();
  db.prepare(
    `INSERT INTO participation_status (id, user_id, event_id, status, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), userId, eventId, status, new Date().toISOString());
  db.close();
  return {
    cleanup() {
      const db2 = openDb();
      db2.prepare("DELETE FROM participation_status WHERE user_id = ? AND event_id = ?").run(userId, eventId);
      db2.close();
    },
  };
}

/** Extract the magic-link token from an email message. */
export function extractMagicToken(msg: EmailMessage | string): string {
  const content = typeof msg === "string" ? msg : (msg.html || msg.text);
  const match = content.match(/\/auth\/verify\?token=([^"&\s<]+)/);
  if (!match) throw new Error("No magic link token found in email");
  return decodeURIComponent(match[1]);
}

/**
 * Extract the 6-letter OTP from an email message.
 * Uses the plain-text body to avoid false matches on base64 tokens in HTML.
 */
export function extractOtp(msg: EmailMessage | string): string {
  // Plain text body contains "Your code: ABCDEF" — much more reliable.
  const text = typeof msg === "string" ? msg : msg.text;
  const textMatch = text.match(/Your code:\s*([A-Z0-9]{6})/i);
  if (textMatch) return textMatch[1];

  // Fallback: look in HTML for the code surrounded by whitespace / tags
  const html = typeof msg === "string" ? msg : msg.html;
  const htmlMatch = html.match(/>([A-Z0-9]{6})</);
  if (htmlMatch) return htmlMatch[1];

  throw new Error("No OTP found in email");
}

export interface EmailMessage {
  html: string;
  text: string;
}

/** Poll mailpit until an email arrives for `recipient`. Timeout in ms. */
export async function waitForEmail(
  recipient: string,
  timeout = 15000,
): Promise<EmailMessage> {
  const apiUrl = process.env.MAILPIT_API_URL ?? "http://localhost:8025";
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const res = await fetch(`${apiUrl}/api/v1/messages`);
    const data = (await res.json()) as { messages?: Array<{ ID: string; To: Array<{ Address: string }> }> };
    const found = data.messages?.find((m) =>
      m.To?.some((r) => r.Address.toLowerCase() === recipient.toLowerCase()),
    );

    if (found) {
      const full = await fetch(`${apiUrl}/api/v1/message/${found.ID}`);
      const msg = (await full.json()) as { HTML?: string; Text?: string };
      return { html: msg.HTML ?? "", text: msg.Text ?? "" };
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`No email for ${recipient} after ${timeout}ms`);
}

/** Delete all mailpit messages (call before tests that check for emails). */
export async function clearMailpit(): Promise<void> {
  const apiUrl = process.env.MAILPIT_API_URL ?? "http://localhost:8025";
  await fetch(`${apiUrl}/api/v1/messages`, { method: "DELETE" });
}

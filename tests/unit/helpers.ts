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
      db2.prepare("DELETE FROM users WHERE id = ?").run(userId);
      db2.prepare("DELETE FROM logins WHERE id = ?").run(loginId);
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

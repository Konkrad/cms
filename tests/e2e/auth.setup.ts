/**
 * Playwright global setup: creates a shared authenticated user directly in the
 * database (no email flow) and saves the session cookie as storageState so that
 * all tests in the "chromium" project start pre-authenticated.
 */
import { test as setup } from '@playwright/test';
import { SHARED_E2E_EMAIL } from '../fixtures';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DB_PATH = process.env.DB_PATH ?? path.join(ROOT, 'my-database.db');

export const AUTH_FILE = path.join(ROOT, 'playwright/.auth/user.json');
setup('create shared test session', async ({ page }) => {
  const db = new Database(DB_PATH);
  const email = SHARED_E2E_EMAIL;
  const now = new Date().toISOString();

  // Remove any previous shared session so the token is always fresh
  const existing = db.prepare('SELECT id FROM logins WHERE email = ?').get(email) as any;
  if (existing) {
    const existingUser = db.prepare('SELECT id FROM users WHERE login_id = ?').get(existing.id) as any;
    if (existingUser) {
      // Delete child records in FK-safe order before removing the user
      db.prepare('DELETE FROM tickets WHERE event_id IN (SELECT id FROM events WHERE user_id = ?)').run(existingUser.id);
      db.prepare('DELETE FROM transactions WHERE event_id IN (SELECT id FROM events WHERE user_id = ?)').run(existingUser.id);
      db.prepare('DELETE FROM events WHERE user_id = ?').run(existingUser.id);
      db.prepare('DELETE FROM tickets WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ?)').run(existingUser.id);
      db.prepare('DELETE FROM transactions WHERE user_id = ?').run(existingUser.id);
      db.prepare('DELETE FROM group_representatives WHERE user_id = ?').run(existingUser.id);
      db.prepare('DELETE FROM group_memberships WHERE user_id = ?').run(existingUser.id);
      db.prepare('DELETE FROM form_results WHERE user_id = ?').run(existingUser.id);
      db.prepare('DELETE FROM participation_status WHERE user_id = ?').run(existingUser.id);
      db.prepare('DELETE FROM posts WHERE user_id = ?').run(existingUser.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existingUser.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(existingUser.id);
    }
    db.prepare('DELETE FROM logins WHERE id = ?').run(existing.id);
  }

  // Create a regular member with full consent so they land on / rather than /profile/setup
  const loginId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const sessionToken = crypto.randomBytes(48).toString('hex');
  const sessionId = crypto.randomUUID();
  const consent = JSON.stringify({ lastProfileUpdate: now, locationVerification: now, foodPreference: now, photoConsent: now });
  const expiresAt = new Date(Date.now() + 86400000).toISOString();

  db.prepare('INSERT INTO logins (id, email, expires_at) VALUES (?, ?, ?)').run(loginId, email, expiresAt);
  db.prepare(
    'INSERT INTO users (id, name, family_name, login_id, role, consent, food_preference, photo_consent_given) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(userId, 'E2E', 'User', loginId, 'member', consent, 'none', 1);
  db.prepare(
    'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
  ).run(sessionId, userId, sessionToken, expiresAt);
  db.close();

  // Inject the session cookie and verify authentication
  await page.context().addCookies([
    { name: 'session', value: sessionToken, domain: 'localhost', path: '/' },
  ]);

  await page.goto('/');
  await page.waitForSelector('[aria-label="profile-menu"]', { timeout: 15000 });

  // Persist the authenticated browser state for all dependent test projects
  await page.context().storageState({ path: AUTH_FILE });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { emailAuthService } from "~/services/email-auth.service";
import { openDb, waitForEmail, clearMailpit, extractMagicToken, extractOtp, type EmailMessage } from "./helpers";

function uniqueEmail() {
  return `auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

// Cleanup: collect login/user ids created during each test.
let cleanupIds: { logins: string[]; users: string[]; sessions: string[] } = {
  logins: [],
  users: [],
  sessions: [],
};

function registerForCleanup(loginId?: string, userId?: string, sessionId?: string) {
  if (loginId) cleanupIds.logins.push(loginId);
  if (userId) cleanupIds.users.push(userId);
  if (sessionId) cleanupIds.sessions.push(sessionId);
}

beforeEach(async () => {
  cleanupIds = { logins: [], users: [], sessions: [] };
  await clearMailpit();
});

afterEach(() => {
  const db = openDb();
  for (const id of cleanupIds.sessions) db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  for (const id of cleanupIds.users) db.prepare("DELETE FROM users WHERE id = ?").run(id);
  for (const id of cleanupIds.logins) db.prepare("DELETE FROM logins WHERE email = ? OR id = ?").run(id, id);
  db.close();
});

describe("emailAuthService.sendLoginEmail", () => {
  it("creates a logins row for a new email", async () => {
    const email = uniqueEmail();
    await emailAuthService.sendLoginEmail(email);

    const db = openDb();
    const row = db.prepare("SELECT * FROM logins WHERE email = ?").get(email) as any;
    db.close();

    expect(row).toBeTruthy();
    expect(row.magic_hash).toBeTruthy();
    expect(row.otp_hash).toBeTruthy();
    cleanupIds.logins.push(email);
  });

  it("sends an email that arrives in mailpit", async () => {
    const email = uniqueEmail();
    await emailAuthService.sendLoginEmail(email);

    const msg = await waitForEmail(email);
    expect(msg.html || msg.text).toBeTruthy();
    expect(msg.html).toContain("/auth/verify");
    cleanupIds.logins.push(email);
  });

  it("email contains both a magic link and a 6-letter OTP", async () => {
    const email = uniqueEmail();
    await emailAuthService.sendLoginEmail(email);

    const msg = await waitForEmail(email);
    const token = extractMagicToken(msg);
    const otp = extractOtp(msg);

    expect(token.length).toBeGreaterThan(10);
    expect(otp).toMatch(/^[A-Z0-9]{6}$/);
    cleanupIds.logins.push(email);
  });

  it("replaces an existing logins row on a second send", async () => {
    const email = uniqueEmail();
    await emailAuthService.sendLoginEmail(email);

    const db = openDb();
    const first = db.prepare("SELECT magic_hash FROM logins WHERE email = ?").get(email) as any;
    db.close();

    await clearMailpit();
    await emailAuthService.sendLoginEmail(email);

    const db2 = openDb();
    const second = db2.prepare("SELECT magic_hash FROM logins WHERE email = ?").get(email) as any;
    const count = (db2.prepare("SELECT COUNT(*) as n FROM logins WHERE email = ?").get(email) as any).n;
    db2.close();

    expect(count).toBe(1);
    expect(second.magic_hash).not.toBe(first.magic_hash);
    cleanupIds.logins.push(email);
  });
});

describe("emailAuthService.verifyMagic", () => {
  it("returns a session token and creates a user on first use", async () => {
    const email = uniqueEmail();
    await emailAuthService.sendLoginEmail(email);

    const msg = await waitForEmail(email);
    const token = extractMagicToken(msg);

    const result = await emailAuthService.verifyMagic(token);

    expect(result.success).toBe(true);
    expect(result.session.token).toBeTruthy();
    expect(result.userCreated).toBe(true);

    const db = openDb();
    const session = db.prepare("SELECT * FROM sessions WHERE token = ?").get(result.session.token) as any;
    db.close();
    expect(session).toBeTruthy();

    registerForCleanup(email, result.login.id, session?.id);
  });

  it("marks the magic link as used and rejects a second use", async () => {
    const email = uniqueEmail();
    await emailAuthService.sendLoginEmail(email);

    const msg = await waitForEmail(email);
    const token = extractMagicToken(msg);

    const first = await emailAuthService.verifyMagic(token);
    registerForCleanup(email, first.login.id);

    await expect(emailAuthService.verifyMagic(token)).rejects.toThrow("Link already used");
  });

  it("rejects an invalid token", async () => {
    await expect(
      emailAuthService.verifyMagic(Buffer.from("nobody@example.com:badhex").toString("base64")),
    ).rejects.toThrow();
  });
});

describe("emailAuthService.verifyOtp", () => {
  it("returns a session token on a correct OTP", async () => {
    const email = uniqueEmail();
    await emailAuthService.sendLoginEmail(email);

    const msg = await waitForEmail(email);
    const otp = extractOtp(msg);

    const result = await emailAuthService.verifyOtp(email, otp);

    expect(result.success).toBe(true);
    expect(result.session.token).toBeTruthy();

    const db = openDb();
    const session = db.prepare("SELECT id FROM sessions WHERE token = ?").get(result.session.token) as any;
    db.close();
    registerForCleanup(email, result.login.id, session?.id);
  });

  it("marks OTP as used and rejects a second use", async () => {
    const email = uniqueEmail();
    await emailAuthService.sendLoginEmail(email);

    const msg = await waitForEmail(email);
    const otp = extractOtp(msg);

    const first = await emailAuthService.verifyOtp(email, otp);
    registerForCleanup(email, first.login.id);

    await expect(emailAuthService.verifyOtp(email, otp)).rejects.toThrow("Code already used");
  });

  it("increments attempts and locks out after 5 wrong codes", async () => {
    const email = uniqueEmail();
    await emailAuthService.sendLoginEmail(email);
    cleanupIds.logins.push(email);

    for (let i = 0; i < 4; i++) {
      await expect(emailAuthService.verifyOtp(email, "WRONG1")).rejects.toThrow(/attempts left/);
    }
    await expect(emailAuthService.verifyOtp(email, "WRONG1")).rejects.toThrow("Too many attempts");

    // Even the correct code is now rejected (locked out)
    const msg = await waitForEmail(email);
    const otp = extractOtp(msg);
    await expect(emailAuthService.verifyOtp(email, otp)).rejects.toThrow("Code already used");
  });
});

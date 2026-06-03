import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { logins, sessions, users } from "~/db/schema";
import {
  verifyOtp as compareOtpHash,
  decodeMagicLink,
  encodeMagicLink,
  generateHash,
  generateOTP,
  generateSessionToken,
  getExpiresAt,
  hashMagicToken,
  hashOtp,
  normalizeOtp,
  OTP_ATTEMPTS_LIMIT,
  verifyMagicToken,
} from "~/utils/email-auth";
import { emailNotificationsService } from "~/services/email-notifications.service";
import { env } from "~/env";

/**
 * Email-based authentication service.
 *
 * Responsibilities:
 * - create/replace a single `logins` row per email containing both magic-link and OTP hashes
 * - send the email containing both an encoded magic link and the 6-letter code
 * - verify magic links (single-use) and OTPs (5 attempts max)
 * - create a user record (minimal) after successful verify and create a DB-backed session
 *
 * Note: callers (route handlers) are responsible for setting the cookie using the returned
 *       session token (we return { token, expiresAt }), so the handler can set the
 *       HTTP-only cookie appropriately in the response.
 */
export const emailAuthService = {
  /**
   * Create (or replace) a login row for `email` and send the login email (magic link + OTP).
   * Returns { success: true } on success.
   */
  async sendLoginEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    // Generate tokens
    const rawMagic = generateHash(); // raw token (hex)
    const otp = generateOTP(); // e.g. 'ABCDXY'

    // Hash values for storage
    const magicHash = hashMagicToken(rawMagic); // sync
    const otpHash = await hashOtp(otp); // bcrypt

    const expiresAt = getExpiresAt().toISOString();

    // Upsert login row for this email: update the existing row (preserving its id)
    // or insert a new one. Keep previous values so we can revert if sending email fails.
    const existingRows = await db
      .select()
      .from(logins)
      .where(eq(logins.email, normalizedEmail));
    const existing = existingRows.length ? (existingRows[0] as any) : null;

    const id = existing ? existing.id : crypto.randomUUID();

    // Keep previous values in case we need to revert
    let prev: any = null;
    if (existing) {
      prev = {
        magicHash: existing.magicHash,
        otpHash: existing.otpHash,
        expiresAt: existing.expiresAt,
        otpAttempts: existing.otpAttempts,
        magicUsed: existing.magicUsed,
        otpUsed: existing.otpUsed,
      };

      // Update the existing login row with the new tokens (preserve email & id)
      await db
        .update(logins)
        .set({
          magicHash,
          otpHash,
          expiresAt,
          otpAttempts: 0,
          magicUsed: false,
          otpUsed: false,
        })
        .where(eq(logins.id, id));
    } else {
      // Insert new login row
      await db
        .insert(logins)
        .values({
          id,
          email: normalizedEmail,
          magicHash,
          otpHash,
          expiresAt,
          otpAttempts: 0,
          magicUsed: false,
          otpUsed: false,
        })
        .run();
    }

    // Build magic link (base64 of "email:rawMagic")
    const encoded = encodeMagicLink(normalizedEmail, rawMagic);
    const appUrl = env.APP_URL;
    const link = `${appUrl}/auth/verify?token=${encodeURIComponent(encoded)}`;

    // Send email (if it fails we will revert the login row to its previous state)
    try {
      await emailNotificationsService.sendLoginEmail({
        to: normalizedEmail,
        link,
        code: otp,
      });
      return { success: true };
    } catch (err) {
      // revert or cleanup
      console.error("Failed to send login email, reverting login row:", err);
      if (existing && prev) {
        await db
          .update(logins)
          .set({
            magicHash: prev.magicHash,
            otpHash: prev.otpHash,
            expiresAt: prev.expiresAt,
            otpAttempts: prev.otpAttempts,
            magicUsed: prev.magicUsed,
            otpUsed: prev.otpUsed,
          })
          .where(eq(logins.id, id));
      } else {
        await db.delete(logins).where(eq(logins.email, normalizedEmail));
      }
      throw err;
    }
  },

  /**
   * Verify a magic link encoded token (base64 of "email:rawToken").
   * On success: marks magicUsed, creates user (if not exists), creates session and returns it.
   *
   * meta: optional object with ip and userAgent used for session metadata.
   */
  async verifyMagic(
    encodedToken: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const { email, token: rawToken } = decodeMagicLink(encodedToken);
    const normalizedEmail = email.trim().toLowerCase();

    const rows = await db
      .select()
      .from(logins)
      .where(eq(logins.email, normalizedEmail));
    if (rows.length === 0) {
      throw new Error("Invalid or expired link");
    }
    const login = rows[0] as any;

    // Expiry check
    if (new Date(login.expiresAt) < new Date()) {
      throw new Error("Link expired");
    }

    // Single-use check
    if (login.magicUsed) {
      throw new Error("Link already used");
    }

    // Verify token
    if (!login.magicHash || !verifyMagicToken(rawToken, login.magicHash)) {
      throw new Error("Invalid link");
    }

    // Mark magic as used
    await db
      .update(logins)
      .set({ magicUsed: true })
      .where(eq(logins.id, login.id));

    // Ensure a user exists for this login (create if missing)
    const { user, created } = await ensureUserForLogin(login.id);

    // Create a session for the (existing or newly created) user
    const session = await createSessionForUser(user.id, meta);

    return {
      success: true,
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
      userCreated: created,
      login: {
        id: login.id,
        email: login.email,
      },
    };
  },

  /**
   * Verify an OTP code for a given email (case-insensitive).
   * On success: marks otpUsed, creates user (if not exists), creates session and returns it.
   */
  async verifyOtp(
    email: string,
    code: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = normalizeOtp(code);

    const rows = await db
      .select()
      .from(logins)
      .where(eq(logins.email, normalizedEmail));
    if (rows.length === 0) {
      throw new Error("Invalid or expired code");
    }
    const login = rows[0] as any;

    if (new Date(login.expiresAt) < new Date()) {
      throw new Error("Code expired");
    }

    if (login.otpUsed) {
      throw new Error("Code already used");
    }

    const ok =
      typeof login.otpHash === "string"
        ? await compareOtpHash(normalizedCode, login.otpHash)
        : false;
    if (!ok) {
      // increment attempts
      const attempts = (login.otpAttempts ?? 0) + 1;
      const updates: Partial<typeof login> = { otpAttempts: attempts };
      // If too many attempts, mark otpUsed to block further attempts
      if (attempts >= OTP_ATTEMPTS_LIMIT) {
        updates.otpUsed = true;
      }
      await db.update(logins).set(updates).where(eq(logins.id, login.id));
      const attemptsLeft = Math.max(0, OTP_ATTEMPTS_LIMIT - attempts);
      throw new Error(
        attemptsLeft === 0
          ? "Too many attempts"
          : `Invalid code (${attemptsLeft} attempts left)`,
      );
    }

    // Valid code - mark used
    await db
      .update(logins)
      .set({ otpUsed: true })
      .where(eq(logins.id, login.id));

    // Ensure a user exists for this login (create if missing)
    const { user, created } = await ensureUserForLogin(login.id);

    // Create a session for the (existing or newly created) user
    const session = await createSessionForUser(user.id, meta);

    return {
      success: true,
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
      userCreated: created,
      login: {
        id: login.id,
        email: login.email,
      },
    };
  },

  /**
   * Helper: find login by email
   */
  async findLoginByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    const rows = await db
      .select()
      .from(logins)
      .where(eq(logins.email, normalized));
    return rows.length ? (rows[0] as any) : null;
  },
};

/* -------------------------
   Helpers (module-local)
   ------------------------- */

/** Create a minimal user for a login if user doesn't exist yet */
async function ensureUserForLogin(loginId: string) {
  // Look up user by loginId
  const found = await db.select().from(users).where(eq(users.loginId, loginId));
  if (found.length > 0) {
    return { user: found[0] as any, created: false };
  }

  // create minimal user (name is required in schema -> use empty strings)
  const id = crypto.randomUUID();
  const inserted = await db
    .insert(users)
    .values({
      id,
      name: "",
      familyName: "",
      loginId,
    } as any)
    .returning();
  // .returning() returns an array; take the first
  const user =
    Array.isArray(inserted) && inserted.length > 0
      ? inserted[0]
      : { id, name: "", familyName: "", loginId };
  return { user, created: true };
}

/**
 * Create a DB session row and return token + expiry.
 * Note: `createSessionForLogin` stores the loginId in the sessions.loginId column
 * for pending sessions (before the user record exists). Once the user completes
 * their profile, we will create the user row and update the sessions.userId accordingly.
 */
async function createSessionForLogin(
  loginId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString(); // 7 days

  const id = crypto.randomUUID();
  await db
    .insert(sessions)
    .values({
      id,
      loginId,
      token,
      expiresAt,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
    } as any)
    .run();

  return { token, expiresAt, loginId };
}

/** Create a DB session row for a real user and return token + expiry */
async function createSessionForUser(
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString(); // 7 days

  const id = crypto.randomUUID();
  await db
    .insert(sessions)
    .values({
      id,
      userId,
      token,
      expiresAt,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
    } as any)
    .run();

  return { token, expiresAt };
}

export default emailAuthService;

import bcrypt from "bcryptjs";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "crypto";
import { env } from "~/env";

/**
 * Utilities for email-based authentication:
 * - OTP generation & hashing (bcrypt)
 * - Magic token generation & hashing (HMAC-SHA256 if secret is provided)
 * - Encoding/decoding magic link payload (base64 of "email:token")
 * - Session token generation
 */

/** Defaults */
export const OTP_LENGTH = 6;
export const OTP_ATTEMPTS_LIMIT = 5;
export const MAGIC_LINK_MAX_ATTEMPTS = 1;
export const DEFAULT_EXPIRE_MINUTES = 15;
export const BCRYPT_SALT_ROUNDS = 10;

/** Generate a 6-letter (A-Z) OTP by default */
export function generateOTP(length = OTP_LENGTH): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(randomInt(0, chars.length));
  }
  return out;
}

/** Generate a secure random token (hex) — used for magic link raw token */
export function generateHash(): string {
  return randomBytes(32).toString("hex");
}

/** Generate a session token (hex) */
export function generateSessionToken(): string {
  return randomBytes(48).toString("hex");
}

/** Get a Date object for expiration minutes from now */
export function getExpiresAt(minutes = DEFAULT_EXPIRE_MINUTES): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Hash a magic token server-side.
 * If MAGIC_LINK_SECRET is set it uses HMAC-SHA256(secret, token), otherwise SHA-256(token).
 * Returns hex string.
 */
export function hashMagicToken(token: string): string {
  const secret = env.MAGIC_LINK_SECRET;
  return createHmac("sha256", secret).update(token).digest("hex");
}

/**
 * Verify a raw magic token against the stored hash (hex).
 * Uses timing-safe comparison.
 */
export function verifyMagicToken(
  rawToken: string,
  storedHash: string,
): boolean {
  try {
    const computed = hashMagicToken(rawToken);
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch (err) {
    return false;
  }
}

/**
 * Hash an OTP using bcrypt (asynchronously).
 * Returns the bcrypt hash.
 */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, BCRYPT_SALT_ROUNDS);
}

/** Compare an OTP to a bcrypt hash (async) */
export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  try {
    return bcrypt.compare(otp, hash);
  } catch (err) {
    return false;
  }
}

/** Base64-encode the email + token pair as `base64(email:token)` */
export function encodeMagicLink(email: string, token: string): string {
  const raw = `${email}:${token}`;
  return Buffer.from(raw, "utf8").toString("base64");
}

/** Decode the base64 magic param; returns { email, token } or throws */
export function decodeMagicLink(param: string): {
  email: string;
  token: string;
} {
  try {
    const decoded = Buffer.from(param, "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep === -1) throw new Error("Invalid token format");
    const email = decoded.slice(0, sep);
    const token = decoded.slice(sep + 1);
    if (!email || !token) throw new Error("Invalid token content");
    return { email, token };
  } catch (err) {
    throw new Error("Invalid or corrupt token");
  }
}

/** Normalize OTP input (trim + uppercase) */
export function normalizeOtp(input: string): string {
  return input.trim().toUpperCase();
}

/** How many attempts remain for OTP */
export function otpAttemptsLeft(attemptsUsed: number): number {
  return Math.max(0, OTP_ATTEMPTS_LIMIT - attemptsUsed);
}

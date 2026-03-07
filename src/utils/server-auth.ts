import type {
  RequestEventAction,
  RequestEventCommon,
  RequestEventLoader,
} from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
/* Supabase auth removed: using DB-backed sessions only (local DB sessions are now authoritative) */
import { db } from "~/db/connection";
import { logins, sessions, users } from "~/db/schema";
import type { User } from "../db/schema";

/* Supabase configuration and fallback removed */

export type RequestEvent =
  | RequestEventLoader
  | RequestEventAction
  | RequestEventCommon;

export async function getServerSession(event: RequestEvent) {
  // Support partial event objects (for example callers that pass just `{ sharedMap }`)
  // by preferring any pre-loaded session stored in the sharedMap.
  const maybeSharedMap: any = (event as any)?.sharedMap;
  if (maybeSharedMap && typeof maybeSharedMap.get === "function") {
    const sharedSession = maybeSharedMap.get("session");
    if (sharedSession) {
      // If the shared session already contains a `user` object, return it directly.
      if (sharedSession.user) {
        return sharedSession.user as any;
      }

      // If the shared session itself resembles a user record, return it.
      if (sharedSession.id && (sharedSession.name || sharedSession.role)) {
        return sharedSession as any;
      }

      // If we only have a userId, look up the user in the DB.
      const userId = sharedSession.userId ?? sharedSession.user?.id;
      if (userId) {
        const localRows = await db
          .select()
          .from(users)
          .where(eq(users.id, userId));
        if (localRows.length > 0) {
          const u = localRows[0] as any;
          let email: string | null = null;
          if (u.loginId) {
            const loginRows = await db
              .select()
              .from(logins)
              .where(eq(logins.id, u.loginId));
            if (loginRows.length > 0) email = loginRows[0].email;
          }
          return { ...u, email } as any;
        }
      }

      // Shared session present but couldn't be resolved to a user
      return null;
    }
  }

  // Fallback to cookie-based DB session if cookie access is available
  const sessionToken = (event as any)?.cookie?.get?.("session")?.value;
  if (sessionToken) {
    // Find session row
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.token, sessionToken));
    if (rows.length > 0) {
      const sess = rows[0] as any;
      // Check expiry
      if (new Date(sess.expiresAt) > new Date()) {
        // Fetch the associated user
        const userRows = await db
          .select()
          .from(users)
          .where(eq(users.id, sess.userId));
        if (userRows.length > 0) {
          const user = userRows[0] as any;
          // Optionally attach email from linked login record for backwards compatibility
          let email: string | null = null;
          if (user.loginId) {
            const loginRows = await db
              .select()
              .from(logins)
              .where(eq(logins.id, user.loginId));
            if (loginRows.length > 0) email = loginRows[0].email;
          }
          return { ...user, email } as any;
        }
      }
    }
  }

  // No DB session found — not authenticated
  return null;
}

export async function getCurrentUserData(
  event: RequestEvent,
): Promise<(User & { email?: string | null }) | null> {
  const sessionUser = await getServerSession(event);

  if (!sessionUser) {
    return null;
  }

  // Prefer the local DB-backed user profile
  const local = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id));
  if (local.length > 0) {
    const u = local[0] as any;
    // Resolve email via linked login if available
    let email: string | null = null;
    if (u.loginId) {
      const loginRows = await db
        .select()
        .from(logins)
        .where(eq(logins.id, u.loginId));
      if (loginRows.length > 0) email = loginRows[0].email;
    }

    return {
      id: u.id,
      name: u.name,
      familyName: u.familyName,
      email,
      city: u.city,
      country: u.country,
      longitude: u.longitude,
      latitude: u.latitude,
      yearOfBirth: u.yearOfBirth,
      sex: u.sex,
      profilePicture: u.profilePicture,
      profilePictureSmall: u.profilePictureSmall,
      role: u.role,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    } as any;
  }

  // No local profile found
  return null;
}

export async function isAdmin(event: RequestEvent): Promise<boolean> {
  const userData = await getCurrentUserData(event);

  if (!userData) {
    return false;
  }

  return userData.role === "admin" || userData.role === "moderator";
}

/* pending login helpers removed - legacy details flow no longer used */

export async function requireAuth(event: RequestEvent) {
  const user = await getServerSession(event);

  if (!user) {
    throw event.redirect(302, "/login");
  }

  return user;
}

export async function requireAdmin(event: RequestEvent) {
  const user = await requireAuth(event);
  const adminStatus = await isAdmin(event);

  if (!adminStatus) {
    throw event.redirect(302, "/");
  }

  return user;
}

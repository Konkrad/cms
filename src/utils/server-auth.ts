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
	// First try DB-backed session cookie
	const sessionToken = event.cookie.get("session")?.value;
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
					return { ...user, email };
				}
			}
		}
	}

	// No DB session found — not authenticated
	return null;
}

export async function getCurrentUserData(
	event: RequestEvent,
): Promise<User | null> {
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
			displayName: u.displayName,
			email,
			city: u.city,
			country: u.country,
			longitude: u.longitude,
			latitude: u.latitude,
			yearOfBirth: u.yearOfBirth,
			sex: u.sex,
			role: u.role,
			createdAt: u.createdAt,
			updatedAt: u.updatedAt,
		};
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

export async function getPendingLogin(event: RequestEvent) {
	const token = event.cookie.get("session")?.value;
	if (!token) return null;

	// Find session row by token
	const rows = await db
		.select()
		.from(sessions)
		.where(eq(sessions.token, token));
	if (rows.length === 0) return null;

	const sess = rows[0] as any;

	// Check expiry
	if (new Date(sess.expiresAt) < new Date()) return null;

	// Pending session: must have loginId (the login row) and must NOT have a userId yet
	if (!sess.loginId || sess.userId) return null;

	// Fetch the login row for convenience (may include the email)
	const loginRows = await db
		.select()
		.from(logins)
		.where(eq(logins.id, sess.loginId));
	const login = loginRows.length ? (loginRows[0] as any) : null;

	return { session: sess, login };
}

export async function requirePendingLogin(event: RequestEvent) {
	const pending = await getPendingLogin(event);
	if (!pending) {
		throw event.redirect(302, "/login");
	}
	return pending;
}

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

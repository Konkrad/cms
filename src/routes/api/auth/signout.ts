import type { RequestHandler } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { sessions } from "~/db/schema";

/**
 * Sign out endpoint
 *
 * - Deletes the DB session row matching the current `session` cookie (if present)
 * - Clears the `session` cookie (HTTP-only)
 * - Returns a JSON success/failure payload
 *
 * Note: This endpoint is intentionally idempotent; calling it with no cookie will
 * still result in a successful response (the cookie will be cleared).
 */
export const onPost: RequestHandler = async (event) => {
	try {
		const token = event.cookie.get("session")?.value;

		if (token) {
			try {
				await db.delete(sessions).where(eq(sessions.token, token));
			} catch (err) {
				// Log but continue to clear cookie regardless
				console.error("[api/auth/signout] failed to delete session row", err);
			}
		}

		// Clear the cookie (set to expired)
		event.cookie.set("session", "", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "Strict",
			path: "/",
			expires: new Date(0),
		});

		// Also clear legacy supabase cookies (if present) to be safe
		event.cookie.set("sb-access-token", "", {
			path: "/",
			expires: new Date(0),
		});
		event.cookie.set("sb-refresh-token", "", {
			path: "/",
			expires: new Date(0),
		});

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (err: any) {
		console.error("[api/auth/signout] unexpected error", err);
		return new Response(
			JSON.stringify({
				success: false,
				error: err?.message || "Failed to sign out",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};

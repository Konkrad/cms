/**
 * Shared Playwright fixtures and DB helpers.
 *
 * Fixtures:
 *  - `guestPage`  – unauthenticated page (no session cookie)
 *  - `memberPage` – authenticated as a regular user (no scope role)
 *  - `adminPage`  – authenticated as a platform admin (admin of the root scope)
 *
 * Each authenticated fixture creates a temporary user+login+session in the DB
 * and removes all three rows automatically after the test.
 */

import { type BrowserContext, test as base, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { execSync } from "child_process";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import {
	type CompleteRequirementsOptions,
	completeRequirements,
	REQUIREMENT_VERSIONS,
} from "../scripts/seed-requirements";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = process.env.DB_PATH ?? path.join(ROOT, "my-database.db");

// ── DB helpers ────────────────────────────────────────────────────────────────

export function openDb() {
	const db = new Database(DB_PATH);
	// Mirror the app's connection (src/core/db/connection.ts): wait on a held lock
	// instead of erroring immediately. Tests open many short-lived connections
	// that contend with the dev server's writer; without this they fail with
	// "database is locked" / "locking protocol" under load.
	db.pragma("busy_timeout = 5000");
	return db;
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

// ── Auth session helpers ──────────────────────────────────────────────────────

/** "admin" = platform admin (admin role on the root scope); "user" = no scope role. */
export type UserRole = "user" | "admin";

/** Id of the root scope (the seed creates it; created here when missing). */
export function rootScopeId(db: ReturnType<typeof openDb>): string {
	const row = db
		.prepare("SELECT id FROM scopes WHERE parent_id IS NULL")
		.get() as { id: string } | undefined;
	if (row) return row.id;
	const id = crypto.randomUUID();
	db.prepare(
		"INSERT INTO scopes (id, parent_id, kind, slug, name, path) VALUES (?, NULL, 'root', '', 'Community', '/')",
	).run(id);
	return id;
}

export interface CreatedSession {
	userId: string;
	sessionToken: string;
	cleanup(): void;
}

/**
 * Delete all rows that reference the given userId (and the login row identified
 * by loginId) in the correct FK-safe order, then delete the user itself.
 * This prevents "FOREIGN KEY constraint failed" errors during test cleanup.
 */
function deleteUserCascade(
	db: ReturnType<typeof openDb>,
	userId: string,
	loginId: string,
): void {
	// Child rows of events owned by this user (no cascade on transactions/tickets)
	db.prepare(
		"DELETE FROM tickets WHERE event_id IN (SELECT id FROM events WHERE user_id = ?)",
	).run(userId);
	db.prepare(
		"DELETE FROM transactions WHERE event_id IN (SELECT id FROM events WHERE user_id = ?)",
	).run(userId);
	// Events (CASCADE: inventory_groups, products, participation_status, event_photos)
	db.prepare("DELETE FROM events WHERE user_id = ?").run(userId);
	// Tickets/transactions owned by the user (from their own purchases)
	db.prepare(
		"DELETE FROM tickets WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ?)",
	).run(userId);
	db.prepare("DELETE FROM transactions WHERE user_id = ?").run(userId);
	// Scope roles and memberships
	db.prepare("DELETE FROM scope_roles WHERE user_id = ?").run(userId);
	db.prepare("DELETE FROM scope_memberships WHERE user_id = ?").run(userId);
	// Misc user-linked data
	db.prepare("DELETE FROM form_results WHERE user_id = ?").run(userId);
	db.prepare("DELETE FROM user_requirements WHERE user_id = ?").run(userId);
	db.prepare("DELETE FROM reviews WHERE submitted_by = ?").run(userId);
	db.prepare("UPDATE reviews SET reviewed_by = NULL WHERE reviewed_by = ?").run(
		userId,
	);
	db.prepare("DELETE FROM participation_status WHERE user_id = ?").run(userId);
	db.prepare("DELETE FROM notes WHERE author_id = ?").run(userId);
	db.prepare("DELETE FROM articles WHERE author_id = ?").run(userId);
	db.prepare("DELETE FROM jobs WHERE suggested_by = ?").run(userId);
	// New feature tables
	db.prepare("DELETE FROM election_applications WHERE user_id = ?").run(userId);
	db.prepare("DELETE FROM user_qualifications WHERE user_id = ?").run(userId);
	db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(userId);
	db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(userId);
	db.prepare("DELETE FROM notification_outbox WHERE recipient_user_id = ?").run(
		userId,
	);
	db.prepare("DELETE FROM notification_preferences WHERE user_id = ?").run(
		userId,
	);
	// Sessions and user/login rows
	db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
	db.prepare("DELETE FROM users WHERE id = ?").run(userId);
	db.prepare("DELETE FROM logins WHERE id = ?").run(loginId);
}

/**
 * Create a temporary user + login + session row in the DB.
 * Call `cleanup()` to remove all three rows after the test.
 */
export function createUserSession(
	role: UserRole,
	prefix = "e2e",
	name: { name: string; familyName: string } = {
		name: "Test",
		familyName: "User",
	},
	/** Which requirements are completed (default: all). */
	completed: CompleteRequirementsOptions = {},
): CreatedSession {
	const db = openDb();
	const userId = crypto.randomUUID();
	const loginId = crypto.randomUUID();
	const sessionId = crypto.randomUUID();
	const email = `${prefix}-${role}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}@example.com`;
	const sessionToken = crypto.randomBytes(48).toString("hex");
	const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

	db.prepare("INSERT INTO logins (id, email, expires_at) VALUES (?, ?, ?)").run(
		loginId,
		email,
		expiresAt,
	);
	db.prepare(
		"INSERT INTO users (id, name, family_name, login_id) VALUES (?, ?, ?, ?)",
	).run(userId, name.name, name.familyName, loginId);
	// Role fixtures have completed every user requirement (spec 4.6), so they are not sent to
	// /profile/setup or asked at checkout. Use `createTestUser` for a user with pending ones.
	completeRequirements(db, [userId], completed);
	// A platform admin is an admin of the root scope.
	if (role === "admin") {
		db.prepare(
			"INSERT INTO scope_roles (user_id, scope_id, role) VALUES (?, ?, 'admin')",
		).run(userId, rootScopeId(db));
	}
	db.prepare(
		"INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
	).run(sessionId, userId, sessionToken, expiresAt);
	db.close();

	return {
		userId,
		sessionToken,
		cleanup() {
			const db2 = openDb();
			deleteUserCascade(db2, userId, loginId);
			db2.close();
		},
	};
}

// ── User helpers ─────────────────────────────────────────────────────────────

export function getUserById(id: string): Record<string, unknown> | undefined {
	const db = openDb();
	const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
		| Record<string, unknown>
		| undefined;
	db.close();
	return row;
}

/** Return the user id for the given login email, or undefined if not found. */
export function getUserIdByEmail(email: string): string | undefined {
	const db = openDb();
	const login = db
		.prepare("SELECT id FROM logins WHERE email = ?")
		.get(email) as { id: string } | undefined;
	if (!login) {
		db.close();
		return undefined;
	}
	const user = db
		.prepare("SELECT id FROM users WHERE login_id = ?")
		.get(login.id) as { id: string } | undefined;
	db.close();
	return user?.id;
}

/** Delete the user and login rows associated with a given login email (mailpit test cleanup). */
export function deleteUserByEmail(email: string): void {
	const db = openDb();
	const login = db
		.prepare("SELECT id FROM logins WHERE email = ?")
		.get(email) as { id: string } | undefined;
	if (login) {
		const user = db
			.prepare("SELECT id FROM users WHERE login_id = ?")
			.get(login.id) as { id: string } | undefined;
		if (user) {
			deleteUserCascade(db, user.id, login.id);
		} else {
			db.prepare("DELETE FROM logins WHERE id = ?").run(login.id);
		}
	}
	db.close();
}

/** Mark user requirements completed for the user with this login email (default: all). */
export function completeRequirementsByEmail(
	email: string,
	options: CompleteRequirementsOptions = {},
): void {
	const userId = getUserIdByEmail(email);
	if (!userId) return;
	const db = openDb();
	completeRequirements(db, [userId], options);
	db.close();
}

/**
 * A logged-in user with only the listed requirements completed (default: none, so the global
 * gate sends them to /profile/setup and checkout asks the event questions).
 */
export function createTestUser(
	opts: {
		completed?: readonly string[];
		values?: Readonly<Record<string, unknown>>;
	} = {},
): CreatedSession {
	return createUserSession(
		"user",
		"req",
		{ name: "Test", familyName: "User" },
		{ only: opts.completed ?? [], values: opts.values },
	);
}

/** Ids of the global requirements (profile, location, onboarding survey). */
export const GLOBAL_REQUIREMENTS = [
	"core.profile",
	"core.location",
	"core.onboarding",
];

/** A user's stored completion of a requirement (`value` parsed), or undefined. */
export function getUserRequirement(
	userId: string,
	requirementId: string,
): { version: number; completedAt: string; value: unknown } | undefined {
	const db = openDb();
	const row = db
		.prepare(
			"SELECT version, completed_at AS completedAt, value FROM user_requirements WHERE user_id = ? AND requirement_id = ?",
		)
		.get(userId, requirementId) as
		| { version: number; completedAt: string; value: string | null }
		| undefined;
	db.close();
	return row
		? { ...row, value: row.value == null ? null : JSON.parse(row.value) }
		: undefined;
}

/** Store a completion at an older version (as if the requirement's version was bumped since). */
export function setRequirementVersion(
	userId: string,
	requirementId: string,
	version: number,
): void {
	const db = openDb();
	db.prepare(
		"UPDATE user_requirements SET version = ? WHERE user_id = ? AND requirement_id = ?",
	).run(version, userId, requirementId);
	db.close();
}

/**
 * Sets (or clears, with null) the root's active onboarding form (`core.onboarding`); returns
 * the previously active form id so the test can restore it.
 */
export function setActiveOnboardingForm(formId: string | null): string | null {
	const db = openDb();
	const rootId = rootScopeId(db);
	const previous = db
		.prepare(
			"SELECT form_id AS formId FROM form_assignments WHERE purpose = 'core.onboarding' AND scope_id = ?",
		)
		.get(rootId) as { formId: string } | undefined;
	db.prepare(
		"DELETE FROM form_assignments WHERE purpose = 'core.onboarding' AND scope_id = ?",
	).run(rootId);
	if (formId)
		db.prepare(
			"INSERT INTO form_assignments (purpose, scope_id, form_id, updated_at) VALUES ('core.onboarding', ?, ?, ?)",
		).run(rootId, formId, new Date().toISOString());
	db.close();
	return previous?.formId ?? null;
}

export { REQUIREMENT_VERSIONS };

// ── Scope helpers (groups are scopes: regions, chapters) ──────────────────────

export type ScopeRole =
	| "admin"
	| "moderator"
	| "coordinator"
	| "representative";

/** The `[scope]` segment of an admin URL: "/" -> "root", "/a/b/" -> "a.b". */
export function adminSegmentOf(path: string): string {
	const slugs = path.split("/").filter(Boolean);
	return slugs.length ? slugs.join(".") : "root";
}

export function getScopeByPath(
	path: string,
): { id: string; name: string; slug: string; path: string } | undefined {
	const db = openDb();
	const row = db
		.prepare("SELECT id, name, slug, path FROM scopes WHERE path = ? LIMIT 1")
		.get(path) as
		| { id: string; name: string; slug: string; path: string }
		| undefined;
	db.close();
	return row;
}

/** Add a user to a scope (explicit membership). */
export function addScopeMember(userId: string, scopeId: string): void {
	const db = openDb();
	db.prepare(
		"INSERT OR IGNORE INTO scope_memberships (user_id, scope_id) VALUES (?, ?)",
	).run(userId, scopeId);
	db.close();
}

export function removeScopeMember(userId: string, scopeId: string): void {
	const db = openDb();
	db.prepare(
		"DELETE FROM scope_memberships WHERE user_id = ? AND scope_id = ?",
	).run(userId, scopeId);
	db.close();
}

/** Grant a scope role directly (bypasses the members page). */
export function grantScopeRole(
	userId: string,
	scopeId: string,
	role: ScopeRole,
): void {
	const db = openDb();
	db.prepare(
		"INSERT OR IGNORE INTO scope_roles (user_id, scope_id, role) VALUES (?, ?, ?)",
	).run(userId, scopeId, role);
	db.close();
}

export function revokeScopeRole(
	userId: string,
	scopeId: string,
	role: ScopeRole,
): void {
	const db = openDb();
	db.prepare(
		"DELETE FROM scope_roles WHERE user_id = ? AND scope_id = ? AND role = ?",
	).run(userId, scopeId, role);
	db.close();
}

export function isScopeMember(userId: string, scopeId: string): boolean {
	const db = openDb();
	const row = db
		.prepare(
			"SELECT 1 FROM scope_memberships WHERE user_id = ? AND scope_id = ?",
		)
		.get(userId, scopeId);
	db.close();
	return !!row;
}

/** Role rows a user holds on a scope (e.g. to verify a grant made through the UI). */
export function getScopeRoles(userId: string, scopeId: string): string[] {
	const db = openDb();
	const rows = db
		.prepare(
			"SELECT role FROM scope_roles WHERE user_id = ? AND scope_id = ? ORDER BY role",
		)
		.all(userId, scopeId) as { role: string }[];
	db.close();
	return rows.map((r) => r.role);
}

// ── Event helpers ─────────────────────────────────────────────────────────────

/** Create a minimal event with one paid product (for consent/checkout tests). */
export function createTestEvent(userId: string): {
	eventId: string;
	cleanup(): void;
} {
	const db = openDb();
	const eventId = crypto.randomUUID();
	const inventoryGroupId = crypto.randomUUID();
	const productId = crypto.randomUUID();
	const start = new Date(Date.now() + 14 * 86400000).toISOString();
	const end = new Date(Date.now() + 14 * 86400000 + 7200000).toISOString();

	db.prepare(
		`INSERT INTO events (id, slug, title, body, start_date, end_date, location_type, user_id, scope_id, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		eventId,
		eventId,
		"Consent Test Event",
		"<p>test</p>",
		start,
		end,
		"online",
		userId,
		rootScopeId(db),
		"public",
	);
	db.prepare(
		`INSERT INTO inventory_groups (id, event_id, name, max_capacity, needs_ticket)
     VALUES (?, ?, ?, ?, ?)`,
	).run(inventoryGroupId, eventId, "General", 100, 1);
	db.prepare(
		`INSERT INTO products (id, event_id, inventory_group_id, name, price, max_quantity, participant_capacity, features)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(productId, eventId, inventoryGroupId, "Standard", 10.0, 1, 1, "[]");
	db.close();

	return {
		eventId,
		cleanup() {
			const db2 = openDb();
			db2.prepare("DELETE FROM products WHERE id = ?").run(productId);
			db2
				.prepare("DELETE FROM inventory_groups WHERE id = ?")
				.run(inventoryGroupId);
			db2.prepare("DELETE FROM events WHERE id = ?").run(eventId);
			db2.close();
		},
	};
}

/**
 * Create an event owned by `organizerId`, optionally owned by a scope and/or members-only, with no
 * products. `past` makes it already finished. `cleanup()` removes it and its participation rows.
 */
export function createScopeEventInDb(opts: {
	organizerId: string;
	title: string;
	/** URL slug in the scope; the event id by default. */
	slug?: string;
	scopeId?: string;
	visibility?: "public" | "members" | "representatives";
	past?: boolean;
	/** Review state (spec 5.2); published by default. */
	status?: "draft" | "in_review" | "published";
}): { eventId: string; cleanup(): void } {
	const db = openDb();
	const eventId = crypto.randomUUID();
	const offset = (opts.past ? -14 : 14) * 86400000;
	const start = new Date(Date.now() + offset).toISOString();
	const end = new Date(Date.now() + offset + 7200000).toISOString();

	db.prepare(
		`INSERT INTO events (id, slug, title, body, start_date, end_date, location_type, user_id, scope_id, visibility, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		eventId,
		opts.slug ?? eventId,
		opts.title,
		"<p>e2e group event</p>",
		start,
		end,
		"online",
		opts.organizerId,
		opts.scopeId ?? rootScopeId(db),
		opts.visibility ?? "public",
		opts.status ?? "published",
	);
	db.close();

	return {
		eventId,
		cleanup() {
			const db2 = openDb();
			db2
				.prepare("DELETE FROM participation_status WHERE event_id = ?")
				.run(eventId);
			const ref = `events:event:${eventId}`;
			db2.prepare("DELETE FROM reviews WHERE ref = ?").run(ref);
			db2.prepare("DELETE FROM form_results WHERE subject_ref = ?").run(ref);
			db2
				.prepare(
					"DELETE FROM notes WHERE subject_type = 'events:event' AND subject_id = ?",
				)
				.run(eventId);
			db2.prepare("DELETE FROM events WHERE id = ?").run(eventId);
			db2.close();
		},
	};
}

/** Set a user's RSVP for an event directly (status yes/no/maybe). */
export function setParticipationInDb(
	userId: string,
	eventId: string,
	status: "yes" | "no" | "maybe",
): void {
	const db = openDb();
	db.prepare(
		"INSERT OR REPLACE INTO participation_status (id, user_id, event_id, status, updated_at) VALUES (?, ?, ?, ?, ?)",
	).run(crypto.randomUUID(), userId, eventId, status, new Date().toISOString());
	db.close();
}

// ── Ticket helpers ────────────────────────────────────────────────────────────

/** Get the login email for a user by their user id. */
export function getUserEmailById(userId: string): string | null {
	const db = openDb();
	const user = db
		.prepare("SELECT login_id FROM users WHERE id = ?")
		.get(userId) as { login_id: string | null } | undefined;
	if (!user?.login_id) {
		db.close();
		return null;
	}
	const login = db
		.prepare("SELECT email FROM logins WHERE id = ?")
		.get(user.login_id) as { email: string } | undefined;
	db.close();
	return login?.email ?? null;
}

/**
 * Create an event + product and return their IDs. Caller is responsible for
 * cleanup (delete products → inventory_groups → events in that order).
 */
export function createTestEventWithProduct(opts: {
	ownerId: string;
	isFuture?: boolean;
	participantCapacity?: number;
	title?: string;
}): { eventId: string; productId: string; cleanup(): void } {
	const db = openDb();
	const eventId = crypto.randomUUID();
	const inventoryGroupId = crypto.randomUUID();
	const productId = crypto.randomUUID();
	const offset = (opts.isFuture !== false ? 7 : -7) * 86400000;
	const start = new Date(Date.now() + offset).toISOString();
	const end = new Date(Date.now() + offset + 7200000).toISOString();

	db.prepare(
		`INSERT INTO events (id, slug, title, body, start_date, end_date, location_type, user_id, scope_id, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		eventId,
		eventId,
		opts.title ?? "Ticket Test Event",
		"<p>test</p>",
		start,
		end,
		"online",
		opts.ownerId,
		rootScopeId(db),
		"public",
	);
	db.prepare(
		`INSERT INTO inventory_groups (id, event_id, name, max_capacity, needs_ticket)
     VALUES (?, ?, ?, ?, ?)`,
	).run(inventoryGroupId, eventId, "General", 100, 1);
	db.prepare(
		`INSERT INTO products (id, event_id, inventory_group_id, name, price, max_quantity, participant_capacity, features)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		productId,
		eventId,
		inventoryGroupId,
		"Standard Ticket",
		0,
		10,
		opts.participantCapacity ?? 1,
		"[]",
	);
	db.close();

	return {
		eventId,
		productId,
		cleanup() {
			const db2 = openDb();
			db2
				.prepare(
					"DELETE FROM ticket_participants WHERE ticket_id IN (SELECT id FROM tickets WHERE event_id = ?)",
				)
				.run(eventId);
			db2.prepare("DELETE FROM tickets WHERE event_id = ?").run(eventId);
			db2.prepare("DELETE FROM transactions WHERE event_id = ?").run(eventId);
			db2.prepare("DELETE FROM products WHERE event_id = ?").run(eventId);
			db2
				.prepare("DELETE FROM inventory_groups WHERE event_id = ?")
				.run(eventId);
			db2.prepare("DELETE FROM events WHERE id = ?").run(eventId);
			db2.close();
		},
	};
}

/**
 * Insert a transaction + ticket row for an existing event/product.
 * Returns the ticketId.
 */
export function createTicketInDb(opts: {
	buyerId: string;
	eventId: string;
	productId: string;
}): string {
	const db = openDb();
	const transactionId = crypto.randomUUID();
	const ticketId = crypto.randomUUID();
	const qrCodeUuid = crypto.randomUUID();
	db.prepare(
		`INSERT INTO transactions (id, user_id, event_id, total_amount, transaction_fee)
     VALUES (?, ?, ?, 0, 0)`,
	).run(transactionId, opts.buyerId, opts.eventId);
	db.prepare(
		`INSERT INTO tickets (id, qr_code_uuid, transaction_id, product_id, event_id, buyer_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
	).run(
		ticketId,
		qrCodeUuid,
		transactionId,
		opts.productId,
		opts.eventId,
		opts.buyerId,
	);
	db.close();
	return ticketId;
}

/** Add a participant row to an existing ticket. */
export function addParticipantToTicket(
	ticketId: string,
	opts: { name: string; email: string; order?: number; userId?: string },
): void {
	const db = openDb();
	db.prepare(
		`INSERT INTO ticket_participants (id, ticket_id, participant_order, name, email, user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
	).run(
		crypto.randomUUID(),
		ticketId,
		opts.order ?? 1,
		opts.name,
		opts.email,
		opts.userId ?? null,
	);
	db.close();
}

// ── Job helpers ───────────────────────────────────────────────────────────────

export function createJobInDb(opts: {
	suggestedBy: string;
	title?: string;
	status?: "pending" | "approved";
	expiresAt?: string;
	/** Owning scope (default: the root). */
	scopeId?: string;
}): { jobId: string; cleanup(): void } {
	const db = openDb();
	const jobId = crypto.randomUUID();
	const expiresAt =
		opts.expiresAt ?? new Date(Date.now() + 30 * 86400000).toISOString();
	db.prepare(
		`INSERT INTO jobs (id, title, body, location_type, expires_at, status, suggested_by, scope_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		jobId,
		opts.title ?? "Test Job",
		"<p>test body</p>",
		"on-site",
		expiresAt,
		opts.status ?? "pending",
		opts.suggestedBy,
		opts.scopeId ?? rootScopeId(db),
	);
	db.close();

	return {
		jobId,
		cleanup() {
			const db2 = openDb();
			db2.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);
			db2.close();
		},
	};
}

export function getJobById(
	id: string,
):
	| { id: string; title: string; status: string; suggested_by: string }
	| undefined {
	const db = openDb();
	const row = db
		.prepare(
			"SELECT id, title, status, suggested_by FROM jobs WHERE id = ? LIMIT 1",
		)
		.get(id) as
		| { id: string; title: string; status: string; suggested_by: string }
		| undefined;
	db.close();
	return row;
}

export function deleteJobById(id: string): void {
	const db = openDb();
	db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
	db.close();
}

// ── Notification helpers ──────────────────────────────────────────────────────

export interface OutboxRow {
	id: string;
	notification_id: string;
	channel: string;
	recipient_user_id: string | null;
	recipient_address: string | null;
	data: string;
	status: "pending" | "sent" | "failed";
	attempts: number;
	last_error: string | null;
}

/** Outbox rows matching all given filters, oldest first. */
export function getOutboxRows(filter: {
	notificationId?: string;
	recipientUserId?: string;
	channel?: string;
}): OutboxRow[] {
	const where: string[] = [];
	const args: string[] = [];
	if (filter.notificationId) {
		where.push("notification_id = ?");
		args.push(filter.notificationId);
	}
	if (filter.recipientUserId) {
		where.push("recipient_user_id = ?");
		args.push(filter.recipientUserId);
	}
	if (filter.channel) {
		where.push("channel = ?");
		args.push(filter.channel);
	}
	const db = openDb();
	const rows = db
		.prepare(
			`SELECT * FROM notification_outbox ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at`,
		)
		.all(...args) as OutboxRow[];
	db.close();
	return rows;
}

export function getOutboxRowById(id: string): OutboxRow | undefined {
	const db = openDb();
	const row = db
		.prepare("SELECT * FROM notification_outbox WHERE id = ?")
		.get(id) as OutboxRow | undefined;
	db.close();
	return row;
}

/** Inserts an outbox row directly (e.g. a failed one for the admin view). */
export function createOutboxRowInDb(opts: {
	notificationId: string;
	channel: string;
	recipientUserId?: string | null;
	recipientAddress?: string | null;
	data?: Record<string, unknown>;
	status?: "pending" | "sent" | "failed";
	attempts?: number;
	lastError?: string | null;
}): { id: string; cleanup(): void } {
	const db = openDb();
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO notification_outbox (id, notification_id, channel, recipient_user_id,
       recipient_address, data, status, attempts, last_error, next_attempt_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		id,
		opts.notificationId,
		opts.channel,
		opts.recipientUserId ?? null,
		opts.recipientAddress ?? null,
		JSON.stringify(opts.data ?? {}),
		opts.status ?? "pending",
		opts.attempts ?? 0,
		opts.lastError ?? null,
		now,
		now,
	);
	db.close();
	return {
		id,
		cleanup() {
			const db2 = openDb();
			db2.prepare("DELETE FROM notification_outbox WHERE id = ?").run(id);
			db2.close();
		},
	};
}

/** The stored preference (null when the user never toggled it, i.e. enabled). */
export function getNotificationPreference(
	userId: string,
	notificationId: string,
	channel: string,
): boolean | null {
	const db = openDb();
	const row = db
		.prepare(
			"SELECT enabled FROM notification_preferences WHERE user_id = ? AND notification_id = ? AND channel = ?",
		)
		.get(userId, notificationId, channel) as { enabled: number } | undefined;
	db.close();
	return row ? row.enabled === 1 : null;
}

// ── Deal helpers ──────────────────────────────────────────────────────────────

export function createDealInDb(opts: {
	name?: string;
	description?: string;
	logo?: string | null;
	validUntil?: string | null;
	steps?: unknown[];
	/** Owning scope (default: the root). */
	scopeId?: string;
}): { dealId: string; cleanup(): void } {
	const db = openDb();
	const dealId = crypto.randomUUID();
	db.prepare(
		`INSERT INTO deals (id, name, description, logo, valid_until, steps, scope_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(
		dealId,
		opts.name ?? "Test Deal",
		opts.description ?? "Test deal description",
		opts.logo ?? null,
		opts.validUntil ?? null,
		JSON.stringify(opts.steps ?? []),
		opts.scopeId ?? rootScopeId(db),
	);
	db.close();
	return { dealId, cleanup: () => deleteDealById(dealId) };
}

export function getDealByName(
	name: string,
): { id: string; name: string; valid_until: string | null } | undefined {
	const db = openDb();
	const row = db
		.prepare("SELECT id, name, valid_until FROM deals WHERE name = ? LIMIT 1")
		.get(name) as
		| { id: string; name: string; valid_until: string | null }
		| undefined;
	db.close();
	return row;
}

export function deleteDealById(id: string): void {
	const db = openDb();
	db.prepare("DELETE FROM deals WHERE id = ?").run(id);
	db.close();
}

// ── Scope helpers ─────────────────────────────────────────────────────────────

/**
 * Insert a scope under `parentPath` (the root scope "/" is created if missing).
 * Returns the new scope's id, path (e.g. "/e2e-region/") and admin URL segment.
 */
export function createScopeInDb(opts: {
	parentPath: string;
	slug: string;
	name?: string;
	kind?: string;
}): { id: string; path: string; segment: string } {
	const db = openDb();
	let parent = db
		.prepare("SELECT id FROM scopes WHERE path = ?")
		.get(opts.parentPath) as { id: string } | undefined;
	if (!parent && opts.parentPath === "/") {
		parent = { id: rootScopeId(db) };
	}
	if (!parent) {
		db.close();
		throw new Error(`Parent scope ${opts.parentPath} not found`);
	}
	const id = crypto.randomUUID();
	const path = `${opts.parentPath}${opts.slug}/`;
	db.prepare(
		"INSERT INTO scopes (id, parent_id, kind, slug, name, path) VALUES (?, ?, ?, ?, ?, ?)",
	).run(
		id,
		parent.id,
		opts.kind ?? "region",
		opts.slug,
		opts.name ?? opts.slug,
		path,
	);
	db.close();
	return { id, path, segment: adminSegmentOf(path) };
}

/**
 * Delete a scope and everything below it, with their roles, memberships and redirects. Their
 * pages, jobs and deals are deleted; other content rows (notes, articles, events, forms, election cycles,
 * qualification types) are handed to the root rather than deleted.
 */
/**
 * Give a scope a new slug, rewriting the paths of its subtree like a rename in the admin
 * (without the redirect rows). References to the scope and its content need no change.
 */
export function renameScopeInDb(id: string, slug: string): { path: string } {
	const db = openDb();
	const scope = db.prepare("SELECT path FROM scopes WHERE id = ?").get(id) as {
		path: string;
	};
	const newPath = scope.path.replace(/[^/]+\/$/, `${slug}/`);
	db.prepare("UPDATE scopes SET slug = ? WHERE id = ?").run(slug, id);
	db.prepare(
		"UPDATE scopes SET path = ? || substr(path, ?) WHERE path LIKE ?",
	).run(newPath, scope.path.length + 1, `${scope.path}%`);
	db.close();
	return { path: newPath };
}

export function deleteScopeById(id: string): void {
	const db = openDb();
	const scope = db.prepare("SELECT path FROM scopes WHERE id = ?").get(id) as
		| { path: string }
		| undefined;
	if (scope) {
		const ids = (
			db
				.prepare(
					"SELECT id FROM scopes WHERE path LIKE ? ORDER BY length(path) DESC",
				)
				.all(`${scope.path}%`) as { id: string }[]
		).map((r) => r.id);
		for (const scopeId of ids) {
			db.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(scopeId);
			db.prepare("DELETE FROM scope_memberships WHERE scope_id = ?").run(
				scopeId,
			);
			for (const table of ["pages", "jobs", "deals", "reviews"]) {
				db.prepare(`DELETE FROM ${table} WHERE scope_id = ?`).run(scopeId);
			}
			const rootId = rootScopeId(db);
			for (const table of [
				"notes",
				"articles",
				"events",
				"forms",
				"election_cycles",
				"qualification_types",
			]) {
				db.prepare(`UPDATE ${table} SET scope_id = ? WHERE scope_id = ?`).run(
					rootId,
					scopeId,
				);
			}
			db.prepare("DELETE FROM scopes WHERE id = ?").run(scopeId);
		}
		const prefix = scope.path.replace(/\/$/, "");
		db.prepare(
			"DELETE FROM redirects WHERE from_path = ? OR from_path LIKE ? OR to_path = ? OR to_path LIKE ?",
		).run(prefix, `${prefix}/%`, prefix, `${prefix}/%`);
	}
	db.close();
}

// ── Note and article helpers ──────────────────────────────────────────────────

type Visibility = "public" | "members" | "representatives";

/** The newest article with this title. */
export function getArticleByTitle(title: string): {
	id: string;
	title: string;
	featured_image: string | null;
	subject_type: string | null;
	subject_id: string | null;
	visibility: string;
} | null {
	const db = openDb();
	const row = db
		.prepare(
			"SELECT id, title, featured_image, subject_type, subject_id, visibility FROM articles WHERE title = ? ORDER BY published_at DESC LIMIT 1",
		)
		.get(title) as ReturnType<typeof getArticleByTitle> | undefined;
	db.close();
	return row ?? null;
}

/** Notes whose body contains `text` (notes have no title), newest first. */
export function getNotesByBodyText(text: string): Array<{
	id: string;
	body: string;
	subject_type: string | null;
	subject_id: string | null;
	visibility: string;
}> {
	const db = openDb();
	const rows = db
		.prepare(
			"SELECT id, body, subject_type, subject_id, visibility FROM notes WHERE body LIKE ? ORDER BY published_at DESC",
		)
		.all(`%${text}%`) as ReturnType<typeof getNotesByBodyText>;
	db.close();
	return rows;
}

/**
 * Create a published note (spec 4.4: short, no title, no image); `subject` attaches it to an
 * item (`{ type: "events:event", id }`). Returns the new note's id.
 */
export function createNoteInDb(opts: {
	body: string;
	userId: string;
	scopeId?: string;
	visibility?: Visibility;
	subject?: { type: string; id: string };
	publishedAt?: string;
}): string {
	const db = openDb();
	const id = crypto.randomUUID();
	const now = opts.publishedAt ?? new Date().toISOString();
	db.prepare(
		"INSERT INTO notes (id, body, author_id, scope_id, visibility, subject_type, subject_id, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	).run(
		id,
		opts.body,
		opts.userId,
		opts.scopeId ?? rootScopeId(db),
		opts.visibility ?? "public",
		opts.subject?.type ?? null,
		opts.subject?.id ?? null,
		now,
		now,
	);
	db.close();
	return id;
}

/**
 * Create a published article (title required, `featuredImage` an optional public S3 key);
 * `subject` attaches it to an item. Returns the new article's id.
 */
export function createArticleInDb(opts: {
	title: string;
	body: string;
	userId: string;
	scopeId?: string;
	visibility?: Visibility;
	featuredImage?: string | null;
	subject?: { type: string; id: string };
	publishedAt?: string;
}): string {
	const db = openDb();
	const id = crypto.randomUUID();
	const now = opts.publishedAt ?? new Date().toISOString();
	db.prepare(
		"INSERT INTO articles (id, title, featured_image, body, author_id, scope_id, visibility, subject_type, subject_id, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
	).run(
		id,
		opts.title,
		opts.featuredImage ?? null,
		opts.body,
		opts.userId,
		opts.scopeId ?? rootScopeId(db),
		opts.visibility ?? "public",
		opts.subject?.type ?? null,
		opts.subject?.id ?? null,
		now,
		now,
	);
	db.close();
	return id;
}

export function deleteNoteById(id: string): void {
	const db = openDb();
	db.prepare("DELETE FROM notes WHERE id = ?").run(id);
	db.close();
}

export function deleteArticleById(id: string): void {
	const db = openDb();
	db.prepare("DELETE FROM articles WHERE id = ?").run(id);
	db.close();
}

export function deleteArticleByTitle(title: string): void {
	const db = openDb();
	db.prepare("DELETE FROM articles WHERE title = ?").run(title);
	db.close();
}

// ── Page / menu helpers ───────────────────────────────────────────────────────

/**
 * Idempotently ensure a published `/news` page with a Stream block (notes and articles) exists
 * (page-builder infrastructure the News specs render the stream through) — a no-op
 * if it already exists. Never deleted by tests: it's reusable plumbing, not
 * per-test data, so specs only need to manage the notes and articles they create.
 */
export function ensureNewsPage(): { pageId: string } {
	const db = openDb();
	const existing = db
		.prepare("SELECT id FROM pages WHERE scope_id = ? AND slug = 'news'")
		.get(rootScopeId(db)) as { id: string } | undefined;
	if (existing) {
		db.close();
		return { pageId: existing.id };
	}

	const pageId = crypto.randomUUID();
	const menuItemId = crypto.randomUUID();
	const now = new Date().toISOString();
	const content = JSON.stringify([
		{
			id: crypto.randomUUID(),
			componentType: "StreamBlock",
			order: 0,
			data: { show: "all", limit: 10 },
		},
	]);

	db.prepare(
		"INSERT INTO pages (id, scope_id, slug, title, content, status, created_at, updated_at) VALUES (?, ?, 'news', 'News', ?, 'published', ?, ?)",
	).run(pageId, rootScopeId(db), content, now, now);
	db.prepare(
		"INSERT INTO menu_items (id, menu_name, title, url, page_id, parent_id, position, status, icon, target, created_at, updated_at) VALUES (?, 'main', 'News', ?, ?, null, 999, 'hidden', null, '_self', ?, ?)",
	).run(menuItemId, `ref:core:page:${pageId}`, pageId, now, now);
	db.close();
	return { pageId };
}

/**
 * A page at `url` ("/<slug>") with a (hidden) menu item linking to it by reference
 * (`ref:core:page:<id>`), owned by the root. With `scopeId` the page belongs to that scope
 * instead (served at "<scope path><slug>") and gets no menu item (`menuItemId` is then empty).
 */
export function createPageInDb(opts: {
	title: string;
	url: string;
	menuName: "main" | "footer";
	status: "draft" | "published";
	scopeId?: string;
	content?: unknown[];
}): { pageId: string; menuItemId: string } {
	const db = openDb();
	const pageId = crypto.randomUUID();
	const menuItemId = crypto.randomUUID();
	const now = new Date().toISOString();

	db.prepare(
		"INSERT INTO pages (id, scope_id, slug, title, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
	).run(
		pageId,
		opts.scopeId ?? rootScopeId(db),
		opts.url.replace(/^\/+|\/+$/g, ""),
		opts.title,
		JSON.stringify(opts.content ?? []),
		opts.status,
		now,
		now,
	);
	if (opts.scopeId) {
		db.close();
		return { pageId, menuItemId: "" };
	}

	const maxPosRow = db
		.prepare("SELECT MAX(position) as pos FROM menu_items WHERE menu_name = ?")
		.get(opts.menuName) as { pos: number | null } | undefined;
	const position = (maxPosRow?.pos ?? 0) + 1;

	db.prepare(
		"INSERT INTO menu_items (id, menu_name, title, url, page_id, parent_id, position, status, icon, target, created_at, updated_at) VALUES (?, ?, ?, ?, ?, null, ?, 'hidden', null, '_self', ?, ?)",
	).run(
		menuItemId,
		opts.menuName,
		opts.title,
		`ref:core:page:${pageId}`,
		pageId,
		position,
		now,
		now,
	);

	db.close();
	return { pageId, menuItemId };
}

export function createMenuItemInDb(opts: {
	menuName: "main" | "footer";
	title: string;
	url: string;
	position: number;
	status?: "visible" | "hidden";
}): string {
	const db = openDb();
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	db.prepare(
		"INSERT INTO menu_items (id, menu_name, title, url, page_id, parent_id, position, status, icon, target, created_at, updated_at) VALUES (?, ?, ?, ?, null, null, ?, ?, null, '_self', ?, ?)",
	).run(
		id,
		opts.menuName,
		opts.title,
		opts.url,
		opts.position,
		opts.status ?? "visible",
		now,
		now,
	);
	db.close();
	return id;
}

/** Delete a page and all its linked menu items. */
export function deletePageAndMenuItems(pageId: string): void {
	const db = openDb();
	db.prepare("DELETE FROM menu_items WHERE page_id = ?").run(pageId);
	db.prepare("DELETE FROM pages WHERE id = ?").run(pageId);
	db.close();
}

export function deleteMenuItemById(id: string): void {
	const db = openDb();
	db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
	db.close();
}

export function getMenuItemByUrl(
	url: string,
): { id: string; title: string; url: string; status: string } | undefined {
	const db = openDb();
	const row = db
		.prepare(
			"SELECT id, title, url, status FROM menu_items WHERE url = ? LIMIT 1",
		)
		.get(url) as
		| { id: string; title: string; url: string; status: string }
		| undefined;
	db.close();
	return row;
}

/** A menu item row by id (its stored `url` may be a `ref:` reference). */
export function getMenuItemById(
	id: string,
): { id: string; title: string; url: string; status: string } | undefined {
	const db = openDb();
	const row = db
		.prepare("SELECT id, title, url, status FROM menu_items WHERE id = ?")
		.get(id) as
		| { id: string; title: string; url: string; status: string }
		| undefined;
	db.close();
	return row;
}

export function getMenuItemPosition(id: string): number | null {
	const db = openDb();
	const row = db
		.prepare("SELECT position FROM menu_items WHERE id = ?")
		.get(id) as { position: number } | undefined;
	db.close();
	return row?.position ?? null;
}

export function getPageContent(pageId: string): Array<Record<string, unknown>> {
	const db = openDb();
	const row = db
		.prepare("SELECT content FROM pages WHERE id = ?")
		.get(pageId) as { content: string } | undefined;
	db.close();
	if (!row?.content) return [];
	try {
		return JSON.parse(row.content) as Array<Record<string, unknown>>;
	} catch {
		return [];
	}
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function injectSessionCookie(context: BrowserContext, token: string) {
	await context.addCookies([
		{
			name: "session",
			value: token,
			domain: "localhost",
			path: "/",
			httpOnly: true,
			secure: false,
			sameSite: "Strict",
		},
	]);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

type DbHelper = {
	getEventIdByTitle: (title: string) => string | null;
	getProductsByEventId: (eventId: string) => unknown[];
	getInventoryGroupsByEventId: (eventId: string) => unknown[];
	getTicketCountByEventId: (eventId: string) => number;
	getTicketCountByEventIdAndEmail: (eventId: string, email: string) => number;
	getTicketCountByEventIdAndUserId: (eventId: string, userId: string) => number;
	getParticipationStatusByEventIdAndUserId: (
		eventId: string,
		userId: string,
	) => string | null;
	getProductSoldQuantityById: (productId: string) => number;
};

type Fixtures = {
	/** Unauthenticated browser page (no session cookie). */
	guestPage: Page;
	/** Browser page authenticated as a regular user (role: "user"). */
	memberPage: Page;
	/** Browser page authenticated as an admin (role: "admin"). */
	adminPage: Page;
	/** Runs the seed script before the test (requires E2E_ALLOW_DB_WRITE=true). */
	dbSeed: null;
	/** DB query helpers for events and products. */
	db: DbHelper;
};

export const test = base.extend<Fixtures>({
	guestPage: async ({ browser }, use) => {
		const context = await browser.newContext({
			storageState: { cookies: [], origins: [] },
		});
		const page = await context.newPage();
		await use(page);
		await context.close();
	},

	memberPage: async ({ browser }, use) => {
		const session = createUserSession("user");
		const context = await browser.newContext();
		await injectSessionCookie(context, session.sessionToken);
		const page = await context.newPage();
		await use(page);
		await context.close();
		session.cleanup();
	},

	adminPage: async ({ browser }, use) => {
		const session = createUserSession("admin");
		const context = await browser.newContext();
		await injectSessionCookie(context, session.sessionToken);
		const page = await context.newPage();
		await use(page);
		await context.close();
		session.cleanup();
	},

	dbSeed: [
		// biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object-destructuring first param to detect fixture usage
		async ({}, use) => {
			const allow = process.env.E2E_ALLOW_DB_WRITE;
			if (!(allow === "true" || allow === "1")) {
				throw new Error(
					'E2E_ALLOW_DB_WRITE must be set to "true" or "1" to run e2e fixtures',
				);
			}
			execSync("node ./scripts/run-seed.js", { stdio: "inherit" });
			await use(null);
		},
		{ auto: false },
	],

	// biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object-destructuring first param to detect fixture usage
	db: async ({}, use) => {
		const sqlite = openDb();
		const helper: DbHelper = {
			getEventIdByTitle(title) {
				const row = sqlite
					.prepare(
						"SELECT id FROM events WHERE title = ? ORDER BY created_at DESC LIMIT 1",
					)
					.get(title) as { id: string } | undefined;
				return row ? row.id : null;
			},
			getProductsByEventId(eventId) {
				return sqlite
					.prepare("SELECT * FROM products WHERE event_id = ?")
					.all(eventId);
			},
			getInventoryGroupsByEventId(eventId) {
				return sqlite
					.prepare("SELECT * FROM inventory_groups WHERE event_id = ?")
					.all(eventId);
			},
			getTicketCountByEventId(eventId) {
				const row = sqlite
					.prepare(
						`SELECT COUNT(*) AS count
           FROM tickets
           WHERE event_id = ?`,
					)
					.get(eventId) as { count: number };
				return row.count;
			},
			getTicketCountByEventIdAndEmail(eventId, email) {
				const row = sqlite
					.prepare(
						`SELECT COUNT(*) AS count
           FROM tickets
           WHERE event_id = ?
             AND buyer_id = (
               SELECT users.id
               FROM users
               INNER JOIN logins ON logins.id = users.login_id
               WHERE logins.email = ?
               LIMIT 1
             )`,
					)
					.get(eventId, email) as { count: number };
				return row.count;
			},
			getTicketCountByEventIdAndUserId(eventId, userId) {
				const row = sqlite
					.prepare(
						`SELECT COUNT(*) AS count
           FROM tickets
           WHERE event_id = ? AND buyer_id = ?`,
					)
					.get(eventId, userId) as { count: number };
				return row.count;
			},
			getParticipationStatusByEventIdAndUserId(eventId, userId) {
				const row = sqlite
					.prepare(
						`SELECT status
           FROM participation_status
           WHERE event_id = ? AND user_id = ?
           LIMIT 1`,
					)
					.get(eventId, userId) as { status: string } | undefined;
				return row?.status ?? null;
			},
			getProductSoldQuantityById(productId) {
				const row = sqlite
					.prepare(
						`SELECT sold_quantity
           FROM products
           WHERE id = ?
           LIMIT 1`,
					)
					.get(productId) as { sold_quantity: number } | undefined;
				return row?.sold_quantity ?? 0;
			},
		};
		await use(helper);
		sqlite.close();
	},
});

export { expect } from "@playwright/test";

/** Email used by the shared pre-authenticated session created in auth.setup.ts. */
export const SHARED_E2E_EMAIL = "e2e-shared@example.com";

// ── New feature DB helpers ─────────────────────────────────────────────────

export function createQualificationTypeInDb(
	overrides: Record<string, unknown> = {},
): { typeId: string; cleanup: () => void } {
	const db = openDb();
	const typeId = crypto.randomUUID();
	db.prepare(
		`INSERT INTO qualification_types (id, slug, label, grants_membership_tier, scope_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(
		typeId,
		(overrides.slug as string) ?? `e2e-type-${typeId.slice(0, 8)}`,
		(overrides.label as string) ?? "E2E Test Type",
		(overrides.grantsMembershipTier as string) ?? "associated",
		(overrides.scopeId as string) ?? rootScopeId(db),
		new Date().toISOString(),
		new Date().toISOString(),
	);
	db.close();
	return {
		typeId,
		cleanup() {
			const db2 = openDb();
			db2
				.prepare("DELETE FROM user_qualifications WHERE type_id = ?")
				.run(typeId);
			db2.prepare("DELETE FROM qualification_types WHERE id = ?").run(typeId);
			db2.close();
		},
	};
}

export function createQualificationInDb(
	userId: string,
	typeId: string,
	status: "pending" | "approved" | "rejected" = "pending",
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
		status,
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

export function createQualificationTokenInDb(
	typeId: string,
	createdBy: string,
): { token: string; cleanup: () => void } {
	const db = openDb();
	const token = crypto.randomBytes(16).toString("hex");
	db.prepare(
		`INSERT INTO qualification_tokens (id, token, type_id, created_by, expires_at, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
	).run(
		crypto.randomUUID(),
		token,
		typeId,
		createdBy,
		new Date(Date.now() + 3600_000).toISOString(),
		new Date().toISOString(),
	);
	db.close();
	return {
		token,
		cleanup() {
			const db2 = openDb();
			db2
				.prepare("DELETE FROM qualification_tokens WHERE token = ?")
				.run(token);
			db2.close();
		},
	};
}

export function createMembershipInDb(
	userId: string,
	tier: "associated" | "full",
): { membershipId: string; cleanup: () => void } {
	const db = openDb();
	const membershipId = crypto.randomUUID();
	db.prepare(
		`INSERT INTO user_memberships (id, user_id, tier, granted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
	).run(
		membershipId,
		userId,
		tier,
		new Date().toISOString(),
		new Date().toISOString(),
		new Date().toISOString(),
	);
	db.close();
	return {
		membershipId,
		cleanup() {
			const db2 = openDb();
			db2
				.prepare("DELETE FROM user_memberships WHERE id = ?")
				.run(membershipId);
			db2.close();
		},
	};
}

export function createUserSessionWithMembership(
	tier: "associated" | "full",
): CreatedSession & { membershipId: string } {
	const session = createUserSession("user");
	const { membershipId } = createMembershipInDb(session.userId, tier);
	const originalCleanup = session.cleanup.bind(session);
	return {
		...session,
		membershipId,
		cleanup() {
			const db = openDb();
			db.prepare("DELETE FROM user_memberships WHERE id = ?").run(membershipId);
			db.close();
			originalCleanup();
		},
	};
}

export function createElectionCycleInDb(
	overrides: Record<string, unknown> = {},
): { cycleId: string; cleanup: () => void } {
	const db = openDb();
	const cycleId = crypto.randomUUID();
	db.prepare(
		`INSERT INTO election_cycles (id, title, year, status, scope_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(
		cycleId,
		(overrides.title as string) ?? "E2E Test Elections",
		(overrides.year as number) ?? 2026,
		(overrides.status as string) ?? "draft",
		(overrides.scopeId as string) ?? rootScopeId(db),
		new Date().toISOString(),
		new Date().toISOString(),
	);
	db.close();
	return {
		cycleId,
		cleanup() {
			const db2 = openDb();
			db2
				.prepare("DELETE FROM election_applications WHERE cycle_id = ?")
				.run(cycleId);
			db2
				.prepare("DELETE FROM election_positions WHERE cycle_id = ?")
				.run(cycleId);
			db2.prepare("DELETE FROM election_cycles WHERE id = ?").run(cycleId);
			db2.close();
		},
	};
}

export function createElectionPositionInDb(
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
		(overrides.title as string) ?? "E2E Position",
		new Date().toISOString(),
	);
	db.close();
	return {
		positionId,
		cleanup() {
			const db2 = openDb();
			db2
				.prepare("DELETE FROM election_applications WHERE position_id = ?")
				.run(positionId);
			db2
				.prepare("DELETE FROM election_positions WHERE id = ?")
				.run(positionId);
			db2.close();
		},
	};
}

export function createElectionApplicationInDb(
	positionId: string,
	cycleId: string,
	userId: string,
	status: "pending" | "approved" | "rejected" = "pending",
	adminNote?: string,
): { appId: string; cleanup: () => void } {
	const db = openDb();
	const appId = crypto.randomUUID();
	db.prepare(
		`INSERT INTO election_applications
       (id, position_id, cycle_id, user_id, status, admin_note, motivation_why, motivation_experience, motivation_goals, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		appId,
		positionId,
		cycleId,
		userId,
		status,
		adminNote ?? null,
		"Why reason",
		"Experience text",
		"Goals text",
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

// ── Redirect helpers ──────────────────────────────────────────────────────────

/** Where a redirects row sends `fromPath`, or null. */
export function getRedirectTarget(fromPath: string): string | null {
	const db = openDb();
	const row = db
		.prepare("SELECT to_path FROM redirects WHERE from_path = ?")
		.get(fromPath) as { to_path: string } | undefined;
	db.close();
	return row?.to_path ?? null;
}

/** Delete the redirects rows from or into paths starting with `prefix` (test cleanup). */
export function deleteRedirectsLike(prefix: string): void {
	const db = openDb();
	db.prepare(
		"DELETE FROM redirects WHERE from_path LIKE ? OR to_path LIKE ?",
	).run(`${prefix}%`, `${prefix}%`);
	db.close();
}

// ── Reviews and forms (spec 4.9, 4.10) ──────────────────────────────────────────

/** An event's review state (`draft`, `in_review`, `published`). */
export function getEventStatus(eventId: string): string | undefined {
	const db = openDb();
	const row = db
		.prepare("SELECT status FROM events WHERE id = ?")
		.get(eventId) as { status: string } | undefined;
	db.close();
	return row?.status;
}

/** The newest review row of an item (`events:event:<id>`, `core:article:<id>`). */
export function getLatestReview(
	ref: string,
): { id: string; status: string; comment: string | null } | undefined {
	const db = openDb();
	const row = db
		.prepare(
			"SELECT id, status, comment FROM reviews WHERE ref = ? ORDER BY created_at DESC LIMIT 1",
		)
		.get(ref) as
		| { id: string; status: string; comment: string | null }
		| undefined;
	db.close();
	return row;
}

/** Marks an event's debrief as requested (what the daily schedule does), `daysAgo` days ago. */
export function setEventDebriefRequested(eventId: string, daysAgo = 0): void {
	const db = openDb();
	db.prepare("UPDATE events SET debrief_requested_at = ? WHERE id = ?").run(
		new Date(Date.now() - daysAgo * 86400000).toISOString(),
		eventId,
	);
	db.close();
}

/** Stored answers attached to an item, newest first (parsed). */
export function getFormResultsBySubject(
	ref: string,
): Array<{ formId: string; answers: Record<string, unknown> }> {
	const db = openDb();
	const rows = db
		.prepare(
			"SELECT form_id AS formId, answers FROM form_results WHERE subject_ref = ? ORDER BY created_at DESC",
		)
		.all(ref) as Array<{ formId: string; answers: string }>;
	db.close();
	return rows.map((r) => ({
		formId: r.formId,
		answers: JSON.parse(r.answers),
	}));
}

/** A form owned by a scope (the root by default); a survey unless `purpose` is set. */
export function createFormInDb(opts: {
	title: string;
	scopeId?: string;
	purpose?: string | null;
	schema?: Record<string, unknown>;
}): { formId: string; cleanup(): void } {
	const db = openDb();
	const formId = crypto.randomUUID();
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO forms (id, scope_id, title, slug, schema, purpose, visibility, allow_resubmission, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, 'private', 0, ?, ?)`,
	).run(
		formId,
		opts.scopeId ?? rootScopeId(db),
		opts.title,
		opts.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
		JSON.stringify(
			opts.schema ?? {
				pages: [
					{
						name: "p",
						elements: [{ type: "text", name: "q1", title: "Question one" }],
					},
				],
			},
		),
		opts.purpose ?? null,
		now,
		now,
	);
	db.close();
	return {
		formId,
		cleanup() {
			const db2 = openDb();
			db2.prepare("DELETE FROM form_assignments WHERE form_id = ?").run(formId);
			db2.prepare("DELETE FROM form_results WHERE form_id = ?").run(formId);
			db2.prepare("DELETE FROM forms WHERE id = ?").run(formId);
			db2.close();
		},
	};
}

/** A result for a form (which locks it). */
export function createFormResultInDb(
	formId: string,
	answers: Record<string, unknown> = { q1: "answer" },
): void {
	const db = openDb();
	db.prepare(
		"INSERT INTO form_results (id, form_id, answers, created_at) VALUES (?, ?, ?, ?)",
	).run(
		crypto.randomUUID(),
		formId,
		JSON.stringify(answers),
		new Date().toISOString(),
	);
	db.close();
}

/** Forms of a scope with this title (e.g. the copy a Duplicate made), newest first. */
export function getFormsByTitle(
	title: string,
): Array<{ id: string; purpose: string | null }> {
	const db = openDb();
	const rows = db
		.prepare(
			"SELECT id, purpose FROM forms WHERE title = ? ORDER BY created_at DESC",
		)
		.all(title) as Array<{ id: string; purpose: string | null }>;
	db.close();
	return rows;
}

/** Deletes forms with this title (and their results and assignments). */
export function deleteFormsByTitle(title: string): void {
	const db = openDb();
	for (const { id } of db
		.prepare("SELECT id FROM forms WHERE title = ?")
		.all(title) as Array<{ id: string }>) {
		db.prepare("DELETE FROM form_assignments WHERE form_id = ?").run(id);
		db.prepare("DELETE FROM form_results WHERE form_id = ?").run(id);
		db.prepare("DELETE FROM forms WHERE id = ?").run(id);
	}
	db.close();
}

// ── Payments (spec 4.7) ──────────────────────────────────────────────────────────────────

export interface PaymentRow {
	id: string;
	module_id: string;
	kind: string;
	ref_id: string;
	user_id: string;
	status: string;
	amount: number;
	currency: string;
	provider_ref: string | null;
	subject_ref: string | null;
}

/**
 * A pending ticket order with its pending Stripe payment, as the checkout creates them (for
 * webhook tests that skip the checkout UI). Prices in euros; returns the ids and a cleanup.
 */
export function createPendingTicketPaymentInDb(opts: {
	buyerId: string;
	eventId: string;
	productId: string;
	unitPrice: number;
	quantity?: number;
}): { paymentId: string; transactionId: string; cleanup: () => void } {
	const db = openDb();
	const paymentId = crypto.randomUUID();
	const transactionId = crypto.randomUUID();
	const quantity = opts.quantity ?? 1;
	const now = new Date().toISOString();
	const amount = Math.round(opts.unitPrice * 100);
	db.prepare(
		`INSERT INTO payments (id, module_id, kind, ref_id, user_id, status, mode, provider, provider_ref, amount, currency, lines, subject_ref, created_at, updated_at, expires_at)
     VALUES (?, 'events', 'tickets', ?, ?, 'pending', 'payment', 'stripe', ?, ?, 'eur', ?, ?, ?, ?, ?)`,
	).run(
		paymentId,
		transactionId,
		opts.buyerId,
		`cs_e2e_${paymentId.replaceAll("-", "")}`,
		amount * quantity,
		JSON.stringify([{ label: "Ticket", amount, quantity }]),
		`events:event:${opts.eventId}`,
		now,
		now,
		new Date(Date.now() + 3600_000).toISOString(),
	);
	db.prepare(
		`INSERT INTO transactions (id, user_id, event_id, total_amount, transaction_fee, status, payment_id, participants)
     VALUES (?, ?, ?, ?, 0, 'pending', ?, '[]')`,
	).run(
		transactionId,
		opts.buyerId,
		opts.eventId,
		opts.unitPrice * quantity,
		paymentId,
	);
	db.prepare(
		`INSERT INTO transaction_items (id, transaction_id, product_id, quantity, unit_price)
     VALUES (?, ?, ?, ?, ?)`,
	).run(
		crypto.randomUUID(),
		transactionId,
		opts.productId,
		quantity,
		opts.unitPrice,
	);
	db.close();
	return {
		paymentId,
		transactionId,
		cleanup() {
			const d = openDb();
			d.prepare("DELETE FROM tickets WHERE transaction_id = ?").run(
				transactionId,
			);
			d.prepare("DELETE FROM transaction_items WHERE transaction_id = ?").run(
				transactionId,
			);
			d.prepare("DELETE FROM transactions WHERE id = ?").run(transactionId);
			d.prepare("DELETE FROM payment_events WHERE payment_id = ?").run(
				paymentId,
			);
			d.prepare("DELETE FROM payments WHERE id = ?").run(paymentId);
			d.close();
		},
	};
}

export function getPaymentById(id: string): PaymentRow | undefined {
	const db = openDb();
	const row = db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as
		| PaymentRow
		| undefined;
	db.close();
	return row;
}

/** Payments for an item (`events:event:<id>`), newest first. */
export function getPaymentsBySubject(subjectRef: string): PaymentRow[] {
	const db = openDb();
	const rows = db
		.prepare(
			"SELECT * FROM payments WHERE subject_ref = ? ORDER BY created_at DESC",
		)
		.all(subjectRef) as PaymentRow[];
	db.close();
	return rows;
}

export function getTransactionStatus(paymentId: string): string | undefined {
	const db = openDb();
	const row = db
		.prepare("SELECT status FROM transactions WHERE payment_id = ?")
		.get(paymentId) as { status: string } | undefined;
	db.close();
	return row?.status;
}

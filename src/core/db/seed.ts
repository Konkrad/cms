/**
 * Module seeds (manifest `seed`, spec 6): `scripts/seed.ts` (demo data) and
 * `scripts/seed-test.ts` (e2e fixtures) seed core first, then call the `seed` of every ACTIVE
 * module with this context. Seeds run in the seed script's process with its own connection, not
 * in the server; they may write core tables (`ctx.schema`) only for demo/fixture rows about their
 * own items (e.g. a CMS page listing them, notes about an event).
 */
import type BetterSqlite3 from "better-sqlite3";
import crypto from "crypto";
import type { db as appDb } from "./connection";
import type * as dbSchema from "./schema";

export type SeedMode = "demo" | "test";

export interface SeedContext {
	/** `demo` for `npm run db:seed` (local demo content), `test` for the e2e fixtures. */
	mode: SeedMode;
	/** Drizzle over the whole schema (core and every module), on the seed's connection. */
	db: typeof appDb;
	sqlite: BetterSqlite3.Database;
	/** Every table (core and modules): `ctx.schema.events`, `ctx.schema.pages`. */
	schema: typeof dbSchema;
	/** The root scope's id. */
	rootScopeId: string;
	/**
	 * Public S3 keys of the demo images core uploaded (`public/events/seed-<n>.webp`); empty in
	 * test mode or when the images could not be uploaded.
	 */
	imageKeys: readonly string[];
	/** Uploads a public object (demo assets such as deal logos); its key, or null without S3. */
	uploadPublicObject(
		key: string,
		body: Buffer,
		contentType: string,
	): Promise<string | null>;
	log(message: string): void;
}

/** What a module's `seed` does: add its demo (`ctx.mode === "demo"`) or test fixture rows. */
export type ModuleSeed = (ctx: SeedContext) => Promise<void>;

/**
 * Runs the `seed` of each given module in order (the caller passes the ACTIVE modules: an
 * inactive module seeds nothing). Returns the ids of the modules that seeded.
 */
export async function runModuleSeeds(
	modules: ReadonlyArray<{ id: string; seed?: ModuleSeed }>,
	ctx: SeedContext,
): Promise<string[]> {
	const seeded: string[] = [];
	for (const module of modules) {
		if (!module.seed) continue;
		ctx.log(`Seeding module ${module.id} (${ctx.mode})...`);
		await module.seed(ctx);
		seeded.push(module.id);
	}
	return seeded;
}

/** The people core seeds in both modes, as module seeds refer to them. */
export interface SeedPeople {
	/** admin@example.com: admin of the root scope. */
	admin: { id: string };
	/** host@example.com: admin of the root scope. */
	host: { id: string };
	/** user1@example.com … user10@example.com, in that order. */
	testUsers: Array<{ id: string; loginId: string | null }>;
	/** Login ids of the test users (to tell them from bulk users). */
	testLoginIds: Set<string>;
	/** Scopes below the root by slug (`germany`, `berlin`, …). */
	scopeIdsBySlug: Record<string, string>;
	/** -1 = admin, -2 = host, n = testUsers[n] (admin when missing). */
	resolveAuthor(idx: number): string;
}

/** Looks up the people and scopes core seeded (`SeedPeople`). Throws when core did not seed them. */
export function seedPeople(ctx: SeedContext): SeedPeople {
	const { db, schema } = ctx;
	const logins = db.select().from(schema.logins).all();
	const users = db.select().from(schema.users).all();
	const byEmail = (email: string) => {
		const login = logins.find((l) => l.email === email);
		return login ? users.find((u) => u.loginId === login.id) : undefined;
	};
	const admin = byEmail("admin@example.com");
	const host = byEmail("host@example.com");
	if (!admin || !host)
		throw new Error("Seed core first: admin and host users are missing");
	const testUsers = Array.from({ length: 10 }, (_, i) =>
		byEmail(`user${i + 1}@example.com`),
	).flatMap((u) => (u ? [{ id: u.id, loginId: u.loginId }] : []));
	const scopeIdsBySlug = Object.fromEntries(
		db
			.select()
			.from(schema.scopes)
			.all()
			.filter((s) => s.parentId !== null)
			.map((s) => [s.slug, s.id]),
	);
	return {
		admin: { id: admin.id },
		host: { id: host.id },
		testUsers,
		testLoginIds: new Set(testUsers.flatMap((u) => u.loginId ?? [])),
		scopeIdsBySlug,
		resolveAuthor(idx) {
			if (idx === -1) return admin.id;
			if (idx === -2) return host.id;
			return testUsers[idx]?.id ?? admin.id;
		},
	};
}

/** A workflow form (spec 4.10) for the seeds: a form with a purpose, active on a scope. */
export interface WorkflowFormSeed {
	purpose: string;
	title: string;
	slug: string;
	description: string;
	schema: Record<string, unknown>;
	allowResubmission?: boolean;
}

/**
 * The active form of `purpose` on `scopeId`, created and assigned when the scope has none yet
 * (idempotent: an existing assignment is kept). Returns the form id.
 */
export function ensureWorkflowForm(
	sqlite: BetterSqlite3.Database,
	scopeId: string,
	createdBy: string | null,
	form: WorkflowFormSeed,
): string {
	const assigned = sqlite
		.prepare(
			"SELECT form_id AS formId FROM form_assignments WHERE purpose = ? AND scope_id = ?",
		)
		.get(form.purpose, scopeId) as { formId: string } | undefined;
	if (assigned) return assigned.formId;
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	sqlite
		.prepare(
			`INSERT INTO forms (id, scope_id, title, slug, description, schema, purpose, visibility,
			 allow_resubmission, created_by, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 'private', ?, ?, ?, ?)`,
		)
		.run(
			id,
			scopeId,
			form.title,
			form.slug,
			form.description,
			JSON.stringify(form.schema),
			form.purpose,
			form.allowResubmission ? 1 : 0,
			createdBy,
			now,
			now,
		);
	sqlite
		.prepare(
			"INSERT INTO form_assignments (purpose, scope_id, form_id, updated_at) VALUES (?, ?, ?, ?)",
		)
		.run(form.purpose, scopeId, id, now);
	return id;
}

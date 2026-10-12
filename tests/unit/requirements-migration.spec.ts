import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

/**
 * The data migration of spec 4.6: a database built from every migration BEFORE user requirements
 * (the schema at the previous HEAD) with users under the old model (consent JSON, food_preference,
 * photo_consent_given) is migrated, and their answers become user_requirements rows.
 */

const DRIZZLE = path.resolve(__dirname, "../../drizzle");
const migrations = fs
	.readdirSync(DRIZZLE)
	.filter((d) => fs.existsSync(path.join(DRIZZLE, d, "migration.sql")))
	.sort();
const FIRST = migrations.findIndex((d) => d.endsWith("_user_requirements"));

function apply(db: Database.Database, dirs: string[]) {
	for (const dir of dirs) {
		const sql = fs.readFileSync(
			path.join(DRIZZLE, dir, "migration.sql"),
			"utf8",
		);
		// The migrator runs each file in one transaction (PRAGMA foreign_keys is a no-op there).
		db.transaction(() => {
			for (const statement of sql.split("--> statement-breakpoint")) {
				if (statement.trim()) db.exec(statement);
			}
		})();
	}
}

describe("user requirements data migration", () => {
	it("moves consent, food preference and photo consent into user_requirements", () => {
		expect(FIRST).toBeGreaterThan(0);
		const db = new Database(":memory:");
		db.pragma("foreign_keys = ON");
		apply(db, migrations.slice(0, FIRST));

		const insert = db.prepare(
			"INSERT INTO users (id, name, family_name, consent, food_preference, photo_consent_given, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		);
		const updated = "2026-01-01 10:00:00";
		insert.run(
			"full",
			"Ada",
			"L",
			JSON.stringify({
				lastProfileUpdate: "2026-02-01T00:00:00.000Z",
				locationVerification: "2026-02-02T00:00:00.000Z",
				survey: "2026-02-03T00:00:00.000Z",
				foodPreference: "2026-02-04T00:00:00.000Z",
				photoConsent: "2026-02-05T00:00:00.000Z",
			}),
			"vegan",
			1,
			updated,
		);
		// Old seeds stored "yes"/"none" instead of timestamps; "No preference" stored NULL.
		insert.run(
			"legacy",
			"Bob",
			"B",
			JSON.stringify({
				lastProfileUpdate: "yes",
				foodPreference: "2026-03-01T00:00:00.000Z",
			}),
			null,
			0,
			updated,
		);
		insert.run("fresh", "New", "N", "{}", null, null, updated);
		db.prepare(
			"INSERT INTO sessions (id, user_id, token, expires_at) VALUES ('s1', 'full', 't', '2099-01-01')",
		).run();

		apply(db, migrations.slice(FIRST));

		const rows = db
			.prepare(
				"SELECT user_id, requirement_id, version, completed_at, value FROM user_requirements ORDER BY user_id, requirement_id",
			)
			.all() as Array<Record<string, unknown>>;
		const parsed = rows.map((r) => ({
			...r,
			value: r.value == null ? null : JSON.parse(String(r.value)),
		}));
		expect(parsed).toEqual([
			{
				user_id: "full",
				requirement_id: "core.location",
				version: 1,
				completed_at: "2026-02-02T00:00:00.000Z",
				value: null,
			},
			{
				user_id: "full",
				requirement_id: "core.onboarding",
				version: 1,
				completed_at: "2026-02-03T00:00:00.000Z",
				value: null,
			},
			{
				user_id: "full",
				requirement_id: "core.profile",
				version: 1,
				completed_at: "2026-02-01T00:00:00.000Z",
				value: null,
			},
			{
				user_id: "full",
				requirement_id: "events.foodPreference",
				version: 1,
				completed_at: "2026-02-04T00:00:00.000Z",
				value: { foodPreference: "vegan" },
			},
			{
				user_id: "full",
				requirement_id: "events.photoConsent",
				version: 1,
				completed_at: "2026-02-05T00:00:00.000Z",
				value: { photoConsentGiven: true },
			},
			{
				user_id: "legacy",
				requirement_id: "core.profile",
				version: 1,
				completed_at: updated,
				value: null,
			},
			{
				user_id: "legacy",
				requirement_id: "events.foodPreference",
				version: 1,
				completed_at: "2026-03-01T00:00:00.000Z",
				value: { foodPreference: "none" },
			},
			{
				user_id: "legacy",
				requirement_id: "events.photoConsent",
				version: 1,
				completed_at: updated,
				value: { photoConsentGiven: false },
			},
		]);

		// Rows referencing users survive the later migrations (no cascade on a table rebuild).
		expect(db.prepare("SELECT count(*) AS n FROM sessions").get()).toEqual({
			n: 1,
		});
		expect(db.prepare("SELECT count(*) AS n FROM users").get()).toEqual({
			n: 3,
		});
		db.close();
	});
});

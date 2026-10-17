/**
 * User requirements (spec 4.6) for seeds and e2e fixtures: seeded users have every requirement
 * completed so they are not sent to `/profile/setup` or asked at checkout. Pure (no db/env
 * imports) so `tests/fixtures.ts` can use it too. `tests/unit/requirements.spec.ts` checks that
 * the ids and versions match the registry: bump a version here when you bump it there.
 */
import type BetterSqlite3 from "better-sqlite3";

export const REQUIREMENT_VERSIONS: Readonly<Record<string, number>> = {
	"core.profile": 1,
	"core.location": 1,
	"core.onboarding": 1,
	"events.foodPreference": 1,
	"events.photoConsent": 1,
};

/** Stored values of the requirements that have one (private answers). */
export const DEFAULT_REQUIREMENT_VALUES: Readonly<Record<string, unknown>> = {
	"events.foodPreference": { foodPreference: "none" },
	"events.photoConsent": { photoConsentGiven: true },
};

export interface CompleteRequirementsOptions {
	/** Only these requirement ids (default: all). */
	only?: readonly string[];
	/** Leave these out (e.g. the checkout ones, to see the steps). */
	except?: readonly string[];
	/** Values instead of the defaults, by requirement id. */
	values?: Readonly<Record<string, unknown>>;
}

/** Marks requirements completed at their current version (existing rows are kept). */
export function completeRequirements(
	sqlite: BetterSqlite3.Database,
	userIds: readonly string[],
	options: CompleteRequirementsOptions = {},
): void {
	const insert = sqlite.prepare(
		"INSERT OR IGNORE INTO user_requirements (user_id, requirement_id, version, completed_at, value) VALUES (?, ?, ?, ?, ?)",
	);
	const completedAt = new Date().toISOString();
	const ids = Object.keys(REQUIREMENT_VERSIONS).filter(
		(id) =>
			(!options.only || options.only.includes(id)) &&
			!options.except?.includes(id),
	);
	for (const userId of userIds) {
		for (const id of ids) {
			const value = options.values?.[id] ?? DEFAULT_REQUIREMENT_VALUES[id];
			insert.run(
				userId,
				id,
				REQUIREMENT_VERSIONS[id],
				completedAt,
				value === undefined ? null : JSON.stringify(value),
			);
		}
	}
}

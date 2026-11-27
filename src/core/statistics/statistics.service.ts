import { and, gte, inArray, min } from "drizzle-orm";
import { articles } from "~/core/content/schema/articles";
import { notes } from "~/core/content/schema/notes";
import { db } from "~/core/db/connection";
import { userMemberships } from "~/core/memberships/schema";
import { type Scope, scopeMemberships } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import {
	MIN_GROUP_SIZE,
	type StatBucket,
	suppressSmall,
} from "~/core/statistics/suppress";
import { users } from "~/core/users/schema";

/**
 * Statistics (aggregates only). The private profile fields (year of birth, gender, location,
 * membership tier) are read here and leave this file only as counts per group, with small
 * groups hidden (`suppressSmall`). Never returns a person. Server-only.
 */

const DAY_MS = 86_400_000;
const CHUNK = 500;

export const AGE_GROUPS = [
	"under18",
	"18to24",
	"25to34",
	"35to44",
	"45to54",
	"55to64",
	"65plus",
	"unknown",
] as const;
export const GENDERS = [
	"female",
	"male",
	"other",
	"prefer_not_to_say",
	"unknown",
] as const;
export const TIERS = ["none", "associated", "full"] as const;
export const HOMES = ["here", "elsewhere", "noChapter"] as const;

/** Breakdowns of a group of people. */
export interface Demographics {
	people: number;
	ageGroups: StatBucket[];
	gender: StatBucket[];
	tier: StatBucket[];
	/**
	 * Where they live: countries / cities ("city, country") with at least `MIN_GROUP_SIZE`
	 * people, then "other" (the smaller ones together) and "unknown" (`placesOf`).
	 */
	countries: StatBucket[];
	cities: StatBucket[];
	/** How many different countries they live in. */
	countryCount: number;
}

export interface ScopeOverview {
	members: number;
	newLast30Days: number;
	/** New members per month, the last 12 months, oldest first (key `YYYY-MM`). */
	joinedPerMonth: StatBucket[];
	/** Published notes and articles per month, the last 12 months. */
	postsPerMonth: StatBucket[];
	demographics: Demographics;
}

async function inChunks<T>(
	ids: readonly string[],
	query: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
	const out: T[] = [];
	for (let i = 0; i < ids.length; i += CHUNK)
		out.push(...(await query(ids.slice(i, i + CHUNK))));
	return out;
}

/** The last 12 month keys (`YYYY-MM`), oldest first. */
export function lastMonths(now: Date, count = 12): string[] {
	const keys: string[] = [];
	for (let i = count - 1; i >= 0; i--) {
		const d = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
		);
		keys.push(d.toISOString().slice(0, 7));
	}
	return keys;
}

/** Counts per month key of these timestamps, for the given months (unsuppressed). */
export function perMonth(
	dates: ReadonlyArray<string | null | undefined>,
	months: readonly string[],
): StatBucket[] {
	const counts = new Map(months.map((m) => [m, 0]));
	for (const date of dates) {
		const key = date?.slice(0, 7);
		if (key && counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return months.map((key) => ({ key, count: counts.get(key) ?? 0 }));
}

function ageGroup(yearOfBirth: number | null, year: number) {
	if (!yearOfBirth) return "unknown";
	const age = year - yearOfBirth;
	if (age < 18) return "under18";
	if (age < 25) return "18to24";
	if (age < 35) return "25to34";
	if (age < 45) return "35to44";
	if (age < 55) return "45to54";
	if (age < 65) return "55to64";
	return "65plus";
}

/**
 * Places with at least `MIN_GROUP_SIZE` people by name, most first; all smaller ones merged into
 * "other" (with how many places it holds), so no place with only a few people is named; then
 * "unknown". The "other" and "unknown" counts are exact: they name no place.
 */
function placesOf(places: ReadonlyArray<string | null>): StatBucket[] {
	const counts = new Map<string, number>();
	let unknown = 0;
	for (const place of places) {
		if (!place) unknown++;
		else counts.set(place, (counts.get(place) ?? 0) + 1);
	}
	const ranked = [...counts].sort((a, b) => b[1] - a[1]);
	const named = ranked.filter(([, n]) => n >= MIN_GROUP_SIZE);
	const small = ranked.filter(([, n]) => n < MIN_GROUP_SIZE);
	const other = small.reduce((sum, [, n]) => sum + n, 0);
	// No hiding needed: every named place has enough people, and "other" / "unknown" name none.
	return [
		...named.map(([key, count]) => ({ key, count })),
		...(other ? [{ key: "other", count: other, groups: small.length }] : []),
		{ key: "unknown", count: unknown },
	];
}

function tally<K extends string>(
	keys: readonly K[],
	values: Iterable<string>,
): Array<{ key: K; count: number }> {
	const counts = new Map<string, number>(keys.map((k) => [k, 0]));
	for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
	return keys.map((key) => ({ key, count: counts.get(key) ?? 0 }));
}

/** Members of a scope and the scopes below it, with the date they first joined one of them. */
async function membersOf(
	scope: Scope,
): Promise<Array<{ userId: string; joinedAt: string }>> {
	// The root: every account, joined when it was created.
	if (scope.parentId === null)
		return (
			await db
				.select({ userId: users.id, joinedAt: users.createdAt })
				.from(users)
		).map((r) => ({ userId: r.userId, joinedAt: r.joinedAt }));
	const ids = await scopesService.subtreeIds(scope.id);
	return (
		await db
			.select({
				userId: scopeMemberships.userId,
				joinedAt: min(scopeMemberships.createdAt),
			})
			.from(scopeMemberships)
			.where(inArray(scopeMemberships.scopeId, ids))
			.groupBy(scopeMemberships.userId)
	).map((r) => ({ userId: r.userId, joinedAt: r.joinedAt ?? "" }));
}

async function profilesOf(userIds: readonly string[]) {
	return inChunks(userIds, (chunk) =>
		db
			.select({
				id: users.id,
				yearOfBirth: users.yearOfBirth,
				gender: users.sex,
				city: users.city,
				country: users.country,
			})
			.from(users)
			.where(inArray(users.id, chunk)),
	);
}

async function tiersOf(userIds: readonly string[]) {
	const rows = await inChunks(userIds, (chunk) =>
		db
			.select({ userId: userMemberships.userId, tier: userMemberships.tier })
			.from(userMemberships)
			.where(inArray(userMemberships.userId, chunk)),
	);
	return new Map(rows.map((r) => [r.userId, r.tier]));
}

export const statisticsService = {
	/**
	 * Age groups, gender and membership tier of these people (e.g. who came to an event), with
	 * small groups hidden. Unknown ids are ignored.
	 */
	async demographicsOf(
		userIds: readonly string[],
		now: Date = new Date(),
	): Promise<Demographics> {
		const unique = [...new Set(userIds)];
		const [profiles, tiers] = await Promise.all([
			profilesOf(unique),
			tiersOf(unique),
		]);
		const year = now.getUTCFullYear();
		return {
			people: profiles.length,
			ageGroups: suppressSmall(
				tally(
					AGE_GROUPS,
					profiles.map((p) => ageGroup(p.yearOfBirth, year)),
				),
			),
			gender: suppressSmall(
				tally(
					GENDERS,
					profiles.map((p) =>
						(GENDERS as readonly string[]).includes(p.gender ?? "")
							? (p.gender as string)
							: "unknown",
					),
				),
			),
			tier: suppressSmall(
				tally(
					TIERS,
					profiles.map((p) => tiers.get(p.id) ?? "none"),
				),
			),
			countries: placesOf(profiles.map((p) => p.country || null)),
			countryCount: new Set(
				profiles.flatMap((p) => (p.country ? [p.country] : [])),
			).size,
			cities: placesOf(
				profiles.map((p) =>
					p.city ? [p.city, p.country].filter(Boolean).join(", ") : null,
				),
			),
		};
	},

	/**
	 * Where these people belong, seen from `scopeId`: members of it or a scope below it ("here"),
	 * members only of other chapters ("elsewhere"), or of no chapter at all. Small groups hidden.
	 * Empty for the root (everyone belongs to it).
	 */
	async homesOf(
		userIds: readonly string[],
		scopeId: string,
	): Promise<StatBucket[]> {
		const root = await scopesService.getRoot();
		// Seen from the root everyone is "here": no breakdown.
		if (scopeId === root?.id) return [];
		const unique = [...new Set(userIds)];
		const [subtree, rows] = await Promise.all([
			scopesService.subtreeIds(scopeId),
			inChunks(unique, (chunk) =>
				db
					.select({
						userId: scopeMemberships.userId,
						scopeId: scopeMemberships.scopeId,
					})
					.from(scopeMemberships)
					.where(inArray(scopeMemberships.userId, chunk)),
			),
		]);
		const here = new Set(subtree);
		const byUser = new Map<string, string[]>();
		for (const r of rows)
			if (r.scopeId !== root?.id)
				byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r.scopeId]);
		return suppressSmall(
			tally(
				HOMES,
				unique.map((id) => {
					const scopes = byUser.get(id) ?? [];
					if (scopes.some((s) => here.has(s))) return "here";
					return scopes.length ? "elsewhere" : "noChapter";
				}),
			),
		);
	},

	/** Ids of the members of a scope and the scopes below it (on the root: every account). */
	async memberIds(scope: Scope): Promise<string[]> {
		return (await membersOf(scope)).map((m) => m.userId);
	},

	/** The statistics page of a scope: its members (the subtree's), activity and posts. */
	async overview(scope: Scope, now: Date = new Date()): Promise<ScopeOverview> {
		const members = await membersOf(scope);
		const ids = members.map((m) => m.userId);
		const months = lastMonths(now);
		const since = (days: number) =>
			new Date(now.getTime() - days * DAY_MS).toISOString();
		const subtree =
			scope.parentId === null ? null : await scopesService.subtreeIds(scope.id);

		const [demographics, posts] = await Promise.all([
			this.demographicsOf(ids, now),
			Promise.all(
				[notes, articles].map((table) =>
					db
						.select({ at: table.publishedAt })
						.from(table)
						.where(
							and(
								gte(table.publishedAt, `${months[0]}-01`),
								subtree ? inArray(table.scopeId, subtree) : undefined,
							),
						),
				),
			),
		]);

		return {
			members: ids.length,
			newLast30Days: members.filter((m) => m.joinedAt >= since(30)).length,
			joinedPerMonth: perMonth(
				members.map((m) => m.joinedAt),
				months,
			),
			postsPerMonth: perMonth(
				posts.flat().map((p) => p.at),
				months,
			),
			demographics,
		};
	},
};

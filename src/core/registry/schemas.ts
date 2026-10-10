/**
 * DB side of module registration. Loaded by drizzle-kit via `src/db/schema.ts`,
 * so it must not import a DB connection or `~/env`.
 */
import dealsSchema from "../../../modules/deals/schema";
import electionsSchema from "../../../modules/elections/schema";
import jobsSchema from "../../../modules/jobs/schema";
import qualificationsSchema from "../../../modules/qualifications/schema";

// Module tables, picked up by drizzle-kit as part of `src/db/schema.ts`.
export * from "../../../modules/deals/schema";
export * from "../../../modules/elections/schema";
export * from "../../../modules/jobs/schema";
export * from "../../../modules/qualifications/schema";

export const moduleSchemas = [
	dealsSchema,
	electionsSchema,
	jobsSchema,
	qualificationsSchema,
] as const;

type Schemas = typeof moduleSchemas;
type Intersect<T extends readonly unknown[]> = T extends readonly [
	infer H,
	...infer R,
]
	? H & Intersect<R>
	: unknown;
type Rel<S> = S extends { relations: (r: never) => infer C } ? C : never;
type TablesOf<T extends readonly unknown[]> = {
	[I in keyof T]: T[I] extends { tables: infer X } ? X : never;
};

type MergeInto<A, B> = {
	[K in keyof A | keyof B]: K extends keyof A
		? K extends keyof B
			? A[K] & B[K]
			: A[K]
		: K extends keyof B
			? B[K]
			: never;
};
type MergeAll<A, T extends readonly unknown[]> = T extends readonly [
	infer H,
	...infer R,
]
	? MergeAll<MergeInto<A, Rel<H>>, R>
	: A;

/** All module tables, to be spread into the `defineRelations` schema. */
export const moduleTables = Object.assign(
	{},
	...moduleSchemas.map((m) => m.tables),
) as Intersect<TablesOf<Schemas>>;

/** Merges every module's relation part into the core relation config, per table. */
export function withModuleRelations<
	TCore extends Record<string, Record<string, unknown>>,
>(core: TCore, r: unknown): MergeAll<TCore, Schemas> {
	const merged: Record<string, Record<string, unknown>> = { ...core };
	for (const m of moduleSchemas) {
		const part = (
			m.relations as (r: unknown) => Record<string, Record<string, unknown>>
		)(r);
		for (const [table, rels] of Object.entries(part)) {
			merged[table] = { ...merged[table], ...rels };
		}
	}
	return merged as MergeAll<TCore, Schemas>;
}

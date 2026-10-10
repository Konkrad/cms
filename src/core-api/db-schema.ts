/** Core tables/types a module schema may reference. Safe for drizzle-kit (no runtime deps). */

export type { User } from "~/db/schemas/users";
export { users } from "~/db/schemas/users";

import type {
	ExtractTablesFromSchema,
	RelationsBuilder,
} from "drizzle-orm/relations";
import type { users as usersTable } from "~/db/schemas/users";

type Tables = Record<string, unknown>;

/**
 * A module's DB contribution: its tables plus its relation part. `relations` may
 * also add reverse relations on core tables (e.g. `users.jobs`). The core merges
 * all parts in `src/db/schema.ts`; export it as the file's default export.
 */
export function defineModuleSchema<
	TOwn extends Tables,
	TConfig extends Record<string, Record<string, unknown>>,
>(def: {
	tables: TOwn;
	relations: (
		r: RelationsBuilder<
			ExtractTablesFromSchema<TOwn & { users: typeof usersTable }>
		>,
	) => TConfig;
}) {
	return def;
}

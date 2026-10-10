/** Core tables/types a module schema may reference. Safe for drizzle-kit (no runtime deps). */

export { groupMemberships } from "~/db/schemas/group-memberships";
export { groupRepresentatives } from "~/db/schemas/group-representatives";
export type { Group } from "~/db/schemas/groups";
export { groups } from "~/db/schemas/groups";
export { logins } from "~/db/schemas/logins";
export type { User } from "~/db/schemas/users";
export { users } from "~/db/schemas/users";

import type {
	ExtractTablesFromSchema,
	RelationsBuilder,
} from "drizzle-orm/relations";
import type { groups as groupsTable } from "~/db/schemas/groups";
import type { users as usersTable } from "~/db/schemas/users";

type Tables = Record<string, unknown>;

/**
 * A module's DB contribution: its tables plus its relation part. `relations` may
 * also add reverse relations on core tables (e.g. `users.jobs`). The core merges
 * all parts in `src/core/db/schema.ts`; export it as the file's default export.
 */
export function defineModuleSchema<
	TOwn extends Tables,
	TConfig extends Record<string, Record<string, unknown>>,
>(def: {
	tables: TOwn;
	relations: (
		r: RelationsBuilder<
			ExtractTablesFromSchema<
				TOwn & { users: typeof usersTable; groups: typeof groupsTable }
			>
		>,
	) => TConfig;
}) {
	return def;
}

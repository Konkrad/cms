/** Core tables/types a module schema may reference. Safe for drizzle-kit (no runtime deps). */

export { logins } from "~/core/auth/schema/logins";
export { groupMemberships } from "~/core/scopes/schema/group-memberships";
export { groupRepresentatives } from "~/core/scopes/schema/group-representatives";
export type { Group } from "~/core/scopes/schema/groups";
export { groups } from "~/core/scopes/schema/groups";
export type { User } from "~/core/users/schema";
export { users } from "~/core/users/schema";

import type {
	ExtractTablesFromSchema,
	RelationsBuilder,
} from "drizzle-orm/relations";
import type { groups as groupsTable } from "~/core/scopes/schema/groups";
import type { users as usersTable } from "~/core/users/schema";

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

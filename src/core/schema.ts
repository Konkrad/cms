/** Core tables/types a module schema may reference. Safe for drizzle-kit (no runtime deps). */

export { logins } from "~/core/auth/schema/logins";
export { payments } from "~/core/payments/schema";
export type { Scope } from "~/core/scopes/schema/scopes";
export {
	scopeMemberships,
	scopeRoles,
	scopes,
} from "~/core/scopes/schema/scopes";
export {
	VISIBILITIES,
	type Visibility,
} from "~/core/scopes/visibility";
export type { User } from "~/core/users/schema";
export { users } from "~/core/users/schema";

import type {
	ExtractTablesFromSchema,
	RelationsBuilder,
} from "drizzle-orm/relations";
import type { scopes as scopesTable } from "~/core/scopes/schema/scopes";
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
				TOwn & { users: typeof usersTable; scopes: typeof scopesTable }
			>
		>,
	) => TConfig;
}) {
	return def;
}

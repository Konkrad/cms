import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { users } from "../users/schema";

/**
 * What a user has completed or agreed to (spec 4.6): one row per user and requirement, holding
 * the version they completed. A requirement whose definition has a higher `version` is pending
 * again. `value` is the stored answer (photo consent, food preference …); it is private and
 * only read through explicitly named service methods.
 */
export const userRequirements = sqliteTable(
	"user_requirements",
	{
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** `<area>.<name>`, e.g. `core.profile`, `events.photoConsent`. */
		requirementId: text("requirement_id").notNull(),
		version: integer("version").notNull(),
		completedAt: text("completed_at").notNull(),
		value: text("value", { mode: "json" }).$type<unknown>(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.requirementId] })],
);

export type UserRequirement = typeof userRequirements.$inferSelect;

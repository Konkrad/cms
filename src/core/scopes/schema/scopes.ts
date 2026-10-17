import { type InferSelectModel, sql } from "drizzle-orm";
import {
	type AnySQLiteColumn,
	index,
	primaryKey,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { users } from "../../users/schema";

export const SCOPE_ROLES = [
	"admin",
	"moderator",
	"coordinator",
	"representative",
] as const;
export type ScopeRole = (typeof SCOPE_ROLES)[number];

export const scopes = sqliteTable(
	"scopes",
	{
		id: text("id").primaryKey(),
		parentId: text("parent_id").references((): AnySQLiteColumn => scopes.id),
		kind: text("kind").notNull(),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		// Public URL prefix with leading and trailing slash, e.g. "/germany/berlin/".
		path: text("path").notNull().unique(),
		// Profile shown on the scope's home page (all optional).
		description: text("description"),
		// Public S3 keys (public/scopes/...) of the home page image tiles.
		image1: text("image1"),
		image2: text("image2"),
		image3: text("image3"),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		unique("scopes_parent_slug_unique").on(table.parentId, table.slug),
	],
);

export const scopeRoles = sqliteTable(
	"scope_roles",
	{
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		scopeId: text("scope_id")
			.notNull()
			.references(() => scopes.id, { onDelete: "cascade" }),
		role: text("role", { enum: SCOPE_ROLES }).notNull(),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.scopeId, table.role] }),
		index("scope_roles_scope_idx").on(table.scopeId),
	],
);

export const scopeMemberships = sqliteTable(
	"scope_memberships",
	{
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		scopeId: text("scope_id")
			.notNull()
			.references(() => scopes.id, { onDelete: "cascade" }),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.scopeId] }),
		index("scope_memberships_scope_idx").on(table.scopeId),
	],
);

export type Scope = InferSelectModel<typeof scopes>;
export type ScopeRoleRow = InferSelectModel<typeof scopeRoles>;
export type ScopeMembership = InferSelectModel<typeof scopeMemberships>;

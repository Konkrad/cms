import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "~/core/db/connection";
import { childPath, SCOPE_SLUG_RE } from "~/core/router/scope-path";
import { invalidateScopePaths } from "~/core/router/scope-request";
import {
	type Scope,
	type ScopeRole,
	scopeMemberships,
	scopeRoles,
	scopes,
} from "~/core/scopes/schema/scopes";
import {
	type PublicUser,
	publicUserSelect,
	publicUserThumbnailUrl,
} from "~/core/users/public-user";
import { users } from "~/core/users/schema";

export type Role = ScopeRole;

/** A scope member as other users may see them: public fields and the public thumbnail. */
export type ScopeMember = PublicUser & {
	profilePictureSmallUrl: string | null;
	joinedAt: string;
};

export interface ListMembersOptions {
	includeDescendants?: boolean;
	limit?: number;
}
export type Visibility = "public" | "members" | "representatives";

export class ScopeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ScopeError";
	}
}

// Coordinators review content below them, so they view like representatives.
const VIEW_ALL_ROLES: Role[] = [
	"admin",
	"moderator",
	"coordinator",
	"representative",
];

// LIKE treats % and _ as wildcards; slugs never contain them, but escape for safety.
const likePrefix = (path: string) => `${path.replace(/[\\%_]/g, "\\$&")}%`;

export const scopesService = {
	async getRoot(): Promise<Scope | undefined> {
		return db.query.scopes.findFirst({ where: { parentId: { isNull: true } } });
	},

	async ensureRoot(name = "Root"): Promise<Scope> {
		const existing = await this.getRoot();
		if (existing) return existing;
		const [root] = await db
			.insert(scopes)
			.values({
				id: crypto.randomUUID(),
				parentId: null,
				kind: "root",
				slug: "",
				name,
				path: "/",
			})
			.returning();
		invalidateScopePaths();
		return root;
	},

	async create(
		input: { parentId: string; kind: string; slug: string; name: string },
		reservedSlugs: ReadonlySet<string>,
	): Promise<Scope> {
		if (!SCOPE_SLUG_RE.test(input.slug))
			throw new ScopeError(`Invalid scope slug "${input.slug}"`);
		if (reservedSlugs.has(input.slug))
			throw new ScopeError(`Scope slug "${input.slug}" is reserved`);
		if (!input.kind.trim()) throw new ScopeError("Scope kind is required");
		if (!input.name.trim()) throw new ScopeError("Scope name is required");

		const parent = await this.getById(input.parentId);
		if (!parent) throw new ScopeError("Parent scope not found");

		const path = childPath(parent.path, input.slug);
		const duplicate = await db.query.scopes.findFirst({
			where: { parentId: input.parentId, slug: input.slug },
		});
		if (duplicate)
			throw new ScopeError(
				`Scope "${input.slug}" already exists under ${parent.path}`,
			);

		const [created] = await db
			.insert(scopes)
			.values({
				id: crypto.randomUUID(),
				parentId: input.parentId,
				kind: input.kind,
				slug: input.slug,
				name: input.name,
				path,
			})
			.returning();
		invalidateScopePaths();
		return created;
	},

	async getById(id: string): Promise<Scope | undefined> {
		return db.query.scopes.findFirst({ where: { id } });
	},

	async getByPath(path: string): Promise<Scope | undefined> {
		return db.query.scopes.findFirst({ where: { path } });
	},

	async listPaths(): Promise<Set<string>> {
		const rows = await db.select({ path: scopes.path }).from(scopes);
		return new Set(rows.map((r) => r.path));
	},

	/** Ancestors of a scope, root first, excluding the scope itself. */
	async getAncestors(scopeId: string): Promise<Scope[]> {
		const scope = await this.getById(scopeId);
		if (!scope) return [];
		// Ancestor paths are the segment prefixes of the scope's own path.
		const segments = scope.path.split("/").filter(Boolean);
		const ancestorPaths = segments.map(
			(_, i) => `/${segments.slice(0, i).join("/")}${i ? "/" : ""}`,
		);
		if (ancestorPaths.length === 0) return [];
		const rows = await db
			.select()
			.from(scopes)
			.where(inArray(scopes.path, ancestorPaths));
		return rows.sort((a, b) => a.path.length - b.path.length);
	},

	async getDescendants(scopeId: string): Promise<Scope[]> {
		const scope = await this.getById(scopeId);
		if (!scope) return [];
		return db
			.select()
			.from(scopes)
			.where(
				and(
					sql`${scopes.path} LIKE ${likePrefix(scope.path)} ESCAPE '\\'`,
					sql`${scopes.id} != ${scope.id}`,
				),
			)
			.orderBy(asc(scopes.path));
	},

	async getChildren(scopeId: string): Promise<Scope[]> {
		return db
			.select()
			.from(scopes)
			.where(eq(scopes.parentId, scopeId))
			.orderBy(asc(scopes.slug));
	},

	/** Re-parent a scope; rewrites the path of the node and its whole subtree atomically. */
	async move(scopeId: string, newParentId: string): Promise<Scope> {
		const scope = await this.getById(scopeId);
		if (!scope) throw new ScopeError("Scope not found");
		if (scope.parentId === null)
			throw new ScopeError("The root scope cannot be moved");
		const newParent = await this.getById(newParentId);
		if (!newParent) throw new ScopeError("New parent scope not found");
		if (newParent.path.startsWith(scope.path)) {
			throw new ScopeError(
				"A scope cannot be moved under itself or its descendants",
			);
		}
		const clash = await db.query.scopes.findFirst({
			where: { parentId: newParentId, slug: scope.slug },
		});
		if (clash && clash.id !== scope.id) {
			throw new ScopeError(
				`Scope "${scope.slug}" already exists under ${newParent.path}`,
			);
		}

		const oldPath = scope.path;
		const newPath = childPath(newParent.path, scope.slug);

		db.transaction((tx) => {
			tx.update(scopes)
				.set({ parentId: newParentId })
				.where(eq(scopes.id, scopeId))
				.run();
			// substr is 1-based: keep everything after the old prefix.
			tx.update(scopes)
				.set({
					path: sql`${newPath} || substr(${scopes.path}, ${oldPath.length + 1})`,
				})
				.where(sql`${scopes.path} LIKE ${likePrefix(oldPath)} ESCAPE '\\'`)
				.run();
		});
		invalidateScopePaths();

		return (await this.getById(scopeId)) as Scope;
	},

	async delete(scopeId: string): Promise<void> {
		const scope = await this.getById(scopeId);
		if (!scope) throw new ScopeError("Scope not found");
		if (scope.parentId === null)
			throw new ScopeError("The root scope cannot be deleted");
		const children = await this.getChildren(scopeId);
		if (children.length > 0)
			throw new ScopeError("Scope still has child scopes");
		await db.delete(scopes).where(eq(scopes.id, scopeId));
		invalidateScopePaths();
	},

	// ── Roles (inherit downward) ───────────────────────────────────────────────

	async grantRole(userId: string, scopeId: string, role: Role): Promise<void> {
		await db
			.insert(scopeRoles)
			.values({ userId, scopeId, role })
			.onConflictDoNothing();
	},

	async revokeRole(userId: string, scopeId: string, role: Role): Promise<void> {
		await db
			.delete(scopeRoles)
			.where(
				and(
					eq(scopeRoles.userId, userId),
					eq(scopeRoles.scopeId, scopeId),
					eq(scopeRoles.role, role),
				),
			);
	},

	/** Roles held on the scope or any of its ancestors. */
	async getEffectiveRoles(userId: string, scopeId: string): Promise<Set<Role>> {
		const ancestors = await this.getAncestors(scopeId);
		const ids = [...ancestors.map((a) => a.id), scopeId];
		const rows = await db
			.select({ role: scopeRoles.role })
			.from(scopeRoles)
			.where(
				and(eq(scopeRoles.userId, userId), inArray(scopeRoles.scopeId, ids)),
			);
		return new Set(rows.map((r) => r.role));
	},

	async hasRole(
		userId: string,
		scopeId: string,
		roles: Role[],
	): Promise<boolean> {
		const effective = await this.getEffectiveRoles(userId, scopeId);
		return roles.some((r) => effective.has(r));
	},

	/**
	 * Scopes where the user holds one of `roles`, directly or inherited from an ancestor
	 * (so a region admin gets the region and every scope below it), ordered by path.
	 */
	async listScopesWithRole(userId: string, roles: Role[]): Promise<Scope[]> {
		const direct = await db
			.selectDistinct({ path: scopes.path })
			.from(scopeRoles)
			.innerJoin(scopes, eq(scopes.id, scopeRoles.scopeId))
			.where(
				and(eq(scopeRoles.userId, userId), inArray(scopeRoles.role, roles)),
			);
		if (direct.length === 0) return [];
		return db
			.select()
			.from(scopes)
			.where(
				or(
					...direct.map(
						(d) => sql`${scopes.path} LIKE ${likePrefix(d.path)} ESCAPE '\\'`,
					),
				),
			)
			.orderBy(asc(scopes.path));
	},

	/** Roles held directly on one scope, per user (for the scope's admin members page). */
	async listRoleHolders(
		scopeId: string,
	): Promise<Array<PublicUser & { role: Role }>> {
		return db
			.select({ ...publicUserSelect, role: scopeRoles.role })
			.from(scopeRoles)
			.innerJoin(users, eq(users.id, scopeRoles.userId))
			.where(eq(scopeRoles.scopeId, scopeId))
			.orderBy(asc(users.name), asc(users.familyName));
	},

	// ── Membership (counts upward) ─────────────────────────────────────────────

	async join(userId: string, scopeId: string): Promise<void> {
		await db
			.insert(scopeMemberships)
			.values({ userId, scopeId })
			.onConflictDoNothing();
	},

	async leave(userId: string, scopeId: string): Promise<void> {
		await db
			.delete(scopeMemberships)
			.where(
				and(
					eq(scopeMemberships.userId, userId),
					eq(scopeMemberships.scopeId, scopeId),
				),
			);
	},

	/** Explicit membership on the scope or on any descendant. */
	async isMember(userId: string, scopeId: string): Promise<boolean> {
		const scope = await this.getById(scopeId);
		if (!scope) return false;
		const row = await db
			.select({ scopeId: scopeMemberships.scopeId })
			.from(scopeMemberships)
			.innerJoin(scopes, eq(scopes.id, scopeMemberships.scopeId))
			.where(
				and(
					eq(scopeMemberships.userId, userId),
					or(
						eq(scopes.id, scopeId),
						sql`${scopes.path} LIKE ${likePrefix(scope.path)} ESCAPE '\\'`,
					),
				),
			)
			.limit(1);
		return row.length > 0;
	},

	/**
	 * Members of a scope as public cards (name and public thumbnail only), with the date they
	 * joined. `includeDescendants` adds the members of every scope below (a member is listed
	 * once, with their earliest membership).
	 */
	async listMembers(
		scopeId: string,
		{ includeDescendants = false, limit }: ListMembersOptions = {},
	): Promise<ScopeMember[]> {
		const scope = await this.getById(scopeId);
		if (!scope) return [];
		const where = includeDescendants
			? sql`${scopes.path} LIKE ${likePrefix(scope.path)} ESCAPE '\\'`
			: eq(scopeMemberships.scopeId, scopeId);
		const query = db
			.select({
				...publicUserSelect,
				profilePicture: users.profilePicture,
				profilePictureSmall: users.profilePictureSmall,
				joinedAt: sql<string>`MIN(${scopeMemberships.createdAt})`,
			})
			.from(scopeMemberships)
			.innerJoin(users, eq(users.id, scopeMemberships.userId))
			.innerJoin(scopes, eq(scopes.id, scopeMemberships.scopeId))
			.where(where)
			.groupBy(users.id)
			.orderBy(asc(sql`MIN(${scopeMemberships.createdAt})`));
		const rows = limit ? await query.limit(limit) : await query;
		return rows.map(({ profilePicture, profilePictureSmall, ...member }) => ({
			...member,
			profilePictureSmallUrl: publicUserThumbnailUrl({
				profilePicture,
				profilePictureSmall,
			}),
		}));
	},

	/** Number of distinct members of a scope (optionally including the scopes below). */
	async countMembers(
		scopeId: string,
		{ includeDescendants = false }: { includeDescendants?: boolean } = {},
	): Promise<number> {
		const scope = await this.getById(scopeId);
		if (!scope) return 0;
		const [row] = await db
			.select({
				count: sql<number>`COUNT(DISTINCT ${scopeMemberships.userId})`,
			})
			.from(scopeMemberships)
			.innerJoin(scopes, eq(scopes.id, scopeMemberships.scopeId))
			.where(
				includeDescendants
					? sql`${scopes.path} LIKE ${likePrefix(scope.path)} ESCAPE '\\'`
					: eq(scopeMemberships.scopeId, scopeId),
			);
		return Number(row?.count ?? 0);
	},

	// ── Visibility ─────────────────────────────────────────────────────────────

	async canView(
		userId: string | null,
		scopeId: string,
		visibility: Visibility,
	): Promise<boolean> {
		if (visibility === "public") return true;
		if (!userId) return false;
		const roles = await this.getEffectiveRoles(userId, scopeId);
		const hasViewRole = VIEW_ALL_ROLES.some((r) => roles.has(r));
		if (visibility === "representatives") return hasViewRole;
		return hasViewRole || (await this.isMember(userId, scopeId));
	},

	/**
	 * Listing rule: a scope lists items of itself and its ancestors (subject to canView)
	 * and only PUBLIC items of its descendants.
	 */
	async contentFilter(
		scopeId: string,
	): Promise<{ ownAndAncestorIds: string[]; descendantIds: string[] }> {
		const [ancestors, descendants] = await Promise.all([
			this.getAncestors(scopeId),
			this.getDescendants(scopeId),
		]);
		return {
			ownAndAncestorIds: [...ancestors.map((a) => a.id), scopeId],
			descendantIds: descendants.map((d) => d.id),
		};
	},
};

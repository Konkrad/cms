import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "~/db/connection";
import {
	type Scope,
	type ScopeRole,
	scopeMemberships,
	scopeRoles,
	scopes,
} from "~/db/schemas/scopes";
import { childPath, SCOPE_SLUG_RE } from "~/utils/scope-path";
import { invalidateScopePaths } from "~/utils/scope-request";

export type Role = ScopeRole;
export type Visibility = "public" | "members" | "representatives";

export class ScopeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ScopeError";
	}
}

const MANAGING_ROLES: Role[] = ["admin", "moderator", "representative"];
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

	/** Scopes where the user directly holds admin/moderator/representative (not expanded). */
	async listManagedScopes(userId: string): Promise<Scope[]> {
		const rows = await db
			.selectDistinct({ scope: scopes })
			.from(scopeRoles)
			.innerJoin(scopes, eq(scopes.id, scopeRoles.scopeId))
			.where(
				and(
					eq(scopeRoles.userId, userId),
					inArray(scopeRoles.role, MANAGING_ROLES),
				),
			)
			.orderBy(asc(scopes.path));
		return rows.map((r) => r.scope);
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

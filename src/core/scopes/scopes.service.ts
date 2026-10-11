import {
	and,
	asc,
	desc,
	eq,
	inArray,
	isNotNull,
	like,
	or,
	sql,
} from "drizzle-orm";
import { articles } from "~/core/content/schema/articles";
import { notes } from "~/core/content/schema/notes";
import { pages } from "~/core/content/schema/pages";
import { db } from "~/core/db/connection";
import { forms } from "~/core/forms/schema/forms";
import { redirectsService } from "~/core/router/redirects.service";
import { adminUrl, childPath, SCOPE_SLUG_RE } from "~/core/router/scope-path";
import { invalidateScopePaths } from "~/core/router/scope-request";
import { ROOT_KIND, SCOPE_IMAGE_PREFIX } from "~/core/scopes/kinds";
import {
	type Scope,
	type ScopeRole,
	scopeMemberships,
	scopeRoles,
	scopes,
} from "~/core/scopes/schema/scopes";
import type { Visibility } from "~/core/scopes/visibility";
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

/** A role holder on a scope, as a public card. */
export type ScopeRoleHolder = PublicUser & {
	role: Role;
	profilePictureSmallUrl: string | null;
};

export interface ListMembersOptions {
	includeDescendants?: boolean;
	limit?: number;
}
export type { Visibility };

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

/** A scope path and all its ancestors' paths: "/a/b/" -> ["/", "/a/", "/a/b/"]. */
function pathPrefixes(path: string): string[] {
	const segments = path.split("/").filter(Boolean);
	return segments.reduce(
		(acc, segment) => {
			acc.push(`${acc[acc.length - 1]}${segment}/`);
			return acc;
		},
		["/"],
	);
}

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
				kind: ROOT_KIND,
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
		if (input.kind === ROOT_KIND)
			throw new ScopeError("Only the root has the root kind");
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
		await this.assertNoPageAt(input.parentId, input.slug);

		await redirectsService.release(path);
		await redirectsService.release(adminUrl(path));
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

	/**
	 * A child scope's path would shadow a CMS page of its parent with the same slug
	 * (`/germany/about`): reject the slug when such a page exists.
	 */
	async assertNoPageAt(parentId: string, slug: string): Promise<void> {
		const page = await db.query.pages.findFirst({
			where: { scopeId: parentId, slug },
		});
		if (page) {
			throw new ScopeError(
				`A page with the URL segment "${slug}" already exists there`,
			);
		}
	},

	/** Slugs of a scope's children (pages may not take them). */
	async childSlugs(scopeId: string): Promise<Set<string>> {
		const rows = await db
			.select({ slug: scopes.slug })
			.from(scopes)
			.where(eq(scopes.parentId, scopeId));
		return new Set(rows.map((r) => r.slug));
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

	/** Scopes whose name or slug contains `query`, by path (admin link picker). */
	async search(query: string, limit: number): Promise<Scope[]> {
		return db
			.select()
			.from(scopes)
			.where(
				or(like(scopes.name, `%${query}%`), like(scopes.slug, `%${query}%`)),
			)
			.orderBy(asc(scopes.path))
			.limit(limit);
	},

	/** Every scope's id and path (the tree is small; cached by `getScopePathsById`). */
	async listIdPaths(): Promise<Array<{ id: string; path: string }>> {
		return db.select({ id: scopes.id, path: scopes.path }).from(scopes);
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
		await this.assertNoPageAt(newParentId, scope.slug);

		await this.relocate(scope, {
			parentId: newParentId,
			path: childPath(newParent.path, scope.slug),
		});
		return (await this.getById(scopeId)) as Scope;
	},

	/**
	 * Change a scope's slug (its URL segment); rewrites the paths of its subtree like `move`
	 * and redirects the old URLs. Same slug rules as `create`.
	 */
	async changeSlug(
		scopeId: string,
		slug: string,
		reservedSlugs: ReadonlySet<string>,
	): Promise<Scope> {
		const scope = await this.getById(scopeId);
		if (!scope) throw new ScopeError("Scope not found");
		if (scope.parentId === null)
			throw new ScopeError("The root scope has no slug");
		if (slug === scope.slug) return scope;
		if (!SCOPE_SLUG_RE.test(slug))
			throw new ScopeError(`Invalid scope slug "${slug}"`);
		if (reservedSlugs.has(slug))
			throw new ScopeError(`Scope slug "${slug}" is reserved`);
		const parent = (await this.getById(scope.parentId)) as Scope;
		const clash = await db.query.scopes.findFirst({
			where: { parentId: parent.id, slug },
		});
		if (clash)
			throw new ScopeError(
				`Scope "${slug}" already exists under ${parent.path}`,
			);
		await this.assertNoPageAt(parent.id, slug);
		await this.relocate(scope, {
			slug,
			path: childPath(parent.path, slug),
		});
		return (await this.getById(scopeId)) as Scope;
	},

	/**
	 * Give a scope a new path (new parent and/or slug) and rewrite the paths of its whole
	 * subtree atomically, then redirect every old scope path of the subtree to its new one.
	 */
	async relocate(
		scope: Scope,
		change: { path: string; parentId?: string; slug?: string },
	): Promise<void> {
		const oldPath = scope.path;
		const newPath = change.path;
		const subtree = await db
			.select({ path: scopes.path })
			.from(scopes)
			.where(sql`${scopes.path} LIKE ${likePrefix(oldPath)} ESCAPE '\\'`);

		db.transaction((tx) => {
			tx.update(scopes)
				.set({
					...(change.parentId ? { parentId: change.parentId } : {}),
					...(change.slug ? { slug: change.slug } : {}),
				})
				.where(eq(scopes.id, scope.id))
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

		// Deepest first does not matter: each row maps one old scope path to its new one. The
		// admin URLs (`/admin/germany.berlin/…`) of the subtree move along.
		for (const { path } of subtree) {
			const moved = newPath + path.slice(oldPath.length);
			await redirectsService.add(path, moved);
			await redirectsService.add(adminUrl(path), adminUrl(moved));
		}
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

	/** Update the name and description of a scope. */
	async updateProfile(
		scopeId: string,
		input: { name: string; description: string | null },
	): Promise<Scope> {
		const name = input.name.trim();
		if (!name) throw new ScopeError("Scope name is required");
		const [updated] = await db
			.update(scopes)
			.set({ name, description: input.description?.trim() || null })
			.where(eq(scopes.id, scopeId))
			.returning();
		if (!updated) throw new ScopeError("Scope not found");
		return updated;
	},

	/**
	 * Set (or clear with null) one home page image. The key must be a public scope image
	 * (`public/scopes/…`) uploaded through /api/images; anything else is rejected.
	 */
	async setImage(
		scopeId: string,
		slot: 1 | 2 | 3,
		key: string | null,
	): Promise<void> {
		if (
			key !== null &&
			(!key.startsWith(SCOPE_IMAGE_PREFIX) || key.includes(".."))
		) {
			throw new ScopeError("Invalid image key");
		}
		const column = ({ 1: "image1", 2: "image2", 3: "image3" } as const)[slot];
		await db
			.update(scopes)
			.set({ [column]: key })
			.where(eq(scopes.id, scopeId));
	},

	/** Scopes with this slug, anywhere in the tree (slugs are unique among siblings only). */
	async findBySlug(slug: string): Promise<Scope[]> {
		return db.select().from(scopes).where(eq(scopes.slug, slug));
	},

	/** Ids of a scope and every scope below it. */
	async subtreeIds(scopeId: string): Promise<string[]> {
		const scope = await this.getById(scopeId);
		if (!scope) return [];
		const rows = await db
			.select({ id: scopes.id })
			.from(scopes)
			.where(sql`${scopes.path} LIKE ${likePrefix(scope.path)} ESCAPE '\\'`);
		return rows.map((r) => r.id);
	},

	/** Children of a scope with their member counts (members of the child or below). */
	async getChildrenWithMemberCounts(
		scopeId: string,
	): Promise<Array<Scope & { memberCount: number }>> {
		const children = await this.getChildren(scopeId);
		return Promise.all(
			children.map(async (child) => ({
				...child,
				memberCount: await this.countMembers(child.id, {
					includeDescendants: true,
				}),
			})),
		);
	},

	/** Number of notes, articles, pages and forms owned by the scope (core content; modules report their own). */
	async countCoreContent(scopeId: string): Promise<number> {
		const counts = await Promise.all(
			[notes, articles, pages, forms].map((table) =>
				db
					.select({ count: sql<number>`COUNT(*)` })
					.from(table)
					.where(eq(table.scopeId, scopeId)),
			),
		);
		return counts.reduce((sum, [row]) => sum + Number(row?.count ?? 0), 0);
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

	/** Roles held directly on one scope, one row per user and role, as public cards. */
	async listRoleHolders(scopeId: string): Promise<Array<ScopeRoleHolder>> {
		const rows = await db
			.select({
				...publicUserSelect,
				profilePicture: users.profilePicture,
				profilePictureSmall: users.profilePictureSmall,
				role: scopeRoles.role,
			})
			.from(scopeRoles)
			.innerJoin(users, eq(users.id, scopeRoles.userId))
			.where(eq(scopeRoles.scopeId, scopeId))
			.orderBy(asc(scopeRoles.createdAt), asc(users.name));
		return rows.map(({ profilePicture, profilePictureSmall, ...holder }) => ({
			...holder,
			profilePictureSmallUrl: publicUserThumbnailUrl({
				profilePicture,
				profilePictureSmall,
			}),
		}));
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

	/** The scopes a user explicitly joined, ordered by path. */
	async listUserScopes(userId: string): Promise<Scope[]> {
		const rows = await db
			.select({ scope: scopes })
			.from(scopeMemberships)
			.innerJoin(scopes, eq(scopes.id, scopeMemberships.scopeId))
			.where(eq(scopeMemberships.userId, userId))
			.orderBy(asc(scopes.path));
		return rows.map((r) => r.scope);
	},

	/**
	 * userId -> public label: "Local Rep <scope>" for representatives, otherwise the name of
	 * a scope the user joined (the deepest one). Users with neither are absent.
	 */
	async getScopeLabels(userIds: string[]): Promise<Record<string, string>> {
		const labels: Record<string, string> = {};
		if (userIds.length === 0) return labels;
		const repRows = await db
			.select({ userId: scopeRoles.userId, name: scopes.name })
			.from(scopeRoles)
			.innerJoin(scopes, eq(scopes.id, scopeRoles.scopeId))
			.where(
				and(
					inArray(scopeRoles.userId, userIds),
					eq(scopeRoles.role, "representative"),
				),
			);
		for (const rep of repRows) labels[rep.userId] = `Local Rep ${rep.name}`;

		const missing = userIds.filter((id) => !labels[id]);
		if (missing.length > 0) {
			const memberRows = await db
				.select({ userId: scopeMemberships.userId, name: scopes.name })
				.from(scopeMemberships)
				.innerJoin(scopes, eq(scopes.id, scopeMemberships.scopeId))
				.where(
					and(
						inArray(scopeMemberships.userId, missing),
						isNotNull(scopes.parentId),
					),
				)
				.orderBy(desc(sql`length(${scopes.path})`));
			for (const mem of memberRows) labels[mem.userId] ??= mem.name;
		}
		return labels;
	},

	/**
	 * Ids of the scopes whose members-only content the user may see: the scopes they joined
	 * and every ancestor of those (membership counts upward), plus every scope at or below
	 * one where they hold a role (roles inherit downward). Empty for guests.
	 */
	async memberVisibleScopeIds(userId: string | null): Promise<string[]> {
		if (!userId) return [];
		const [memberRows, roleRows] = await Promise.all([
			db
				.select({ path: scopes.path })
				.from(scopeMemberships)
				.innerJoin(scopes, eq(scopes.id, scopeMemberships.scopeId))
				.where(eq(scopeMemberships.userId, userId)),
			db
				.select({ path: scopes.path })
				.from(scopeRoles)
				.innerJoin(scopes, eq(scopes.id, scopeRoles.scopeId))
				.where(eq(scopeRoles.userId, userId)),
		]);
		if (memberRows.length === 0 && roleRows.length === 0) return [];
		const ancestorPaths = new Set(
			memberRows.flatMap((r) => pathPrefixes(r.path)),
		);
		const rows = await db
			.select({ id: scopes.id })
			.from(scopes)
			.where(
				or(
					ancestorPaths.size
						? inArray(scopes.path, [...ancestorPaths])
						: undefined,
					...roleRows.map(
						(r) => sql`${scopes.path} LIKE ${likePrefix(r.path)} ESCAPE '\\'`,
					),
				),
			);
		return rows.map((r) => r.id);
	},

	/**
	 * Ids of the scopes whose representatives-only content the user may see: every scope at or
	 * below one where they hold a role (roles inherit downward). Empty for guests.
	 */
	async roleVisibleScopeIds(userId: string | null): Promise<string[]> {
		if (!userId) return [];
		const roleRows = await db
			.select({ path: scopes.path })
			.from(scopeRoles)
			.innerJoin(scopes, eq(scopes.id, scopeRoles.scopeId))
			.where(
				and(
					eq(scopeRoles.userId, userId),
					inArray(scopeRoles.role, VIEW_ALL_ROLES),
				),
			);
		if (roleRows.length === 0) return [];
		const rows = await db
			.select({ id: scopes.id })
			.from(scopes)
			.where(
				or(
					...roleRows.map(
						(r) => sql`${scopes.path} LIKE ${likePrefix(r.path)} ESCAPE '\\'`,
					),
				),
			);
		return rows.map((r) => r.id);
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

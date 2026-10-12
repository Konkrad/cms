import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "~/core/db/connection";
import { type Review, type ReviewStatus, reviews } from "~/core/reviews/schema";
import { users } from "~/core/users/schema";

export type { Review, ReviewStatus };

/** Storage of review rows (spec 4.9). The rules live in `reviews.ts`. */
export const reviewsService = {
	async create(row: {
		ref: string;
		scopeId: string;
		submittedBy: string;
		data: Record<string, unknown> | null;
		formId: string | null;
	}): Promise<Review> {
		const [created] = await db
			.insert(reviews)
			.values({
				id: crypto.randomUUID(),
				...row,
				status: "in_review",
				createdAt: new Date().toISOString(),
			})
			.returning();
		return created;
	},

	async getById(id: string): Promise<Review | undefined> {
		const [row] = await db.select().from(reviews).where(eq(reviews.id, id));
		return row;
	},

	/** The newest submission of an item. */
	async latestFor(ref: string): Promise<Review | undefined> {
		const [row] = await db
			.select()
			.from(reviews)
			.where(eq(reviews.ref, ref))
			.orderBy(desc(reviews.createdAt), desc(reviews.id))
			.limit(1);
		return row;
	},

	/** The newest submission of each of these items. */
	async latestForMany(refs: readonly string[]): Promise<Map<string, Review>> {
		if (!refs.length) return new Map();
		const rows = await db
			.select()
			.from(reviews)
			.where(inArray(reviews.ref, [...refs]))
			.orderBy(desc(reviews.createdAt), desc(reviews.id));
		const latest = new Map<string, Review>();
		for (const row of rows) if (!latest.has(row.ref)) latest.set(row.ref, row);
		return latest;
	},

	async hasApproved(ref: string): Promise<boolean> {
		const [row] = await db
			.select({ id: reviews.id })
			.from(reviews)
			.where(and(eq(reviews.ref, ref), eq(reviews.status, "approved")))
			.limit(1);
		return !!row;
	},

	/**
	 * Decides a submission that is still in review; false when it was decided meanwhile (two
	 * reviewers at once: the first decision wins).
	 */
	async decide(
		id: string,
		decision: {
			status: "approved" | "rejected";
			reviewedBy: string;
			comment: string | null;
		},
	): Promise<Review | undefined> {
		const [row] = await db
			.update(reviews)
			.set({ ...decision, decidedAt: new Date().toISOString() })
			.where(and(eq(reviews.id, id), eq(reviews.status, "in_review")))
			.returning();
		return row;
	},

	/**
	 * Submissions in these scopes, newest first, with the submitter's and reviewer's public
	 * names (`status` filters).
	 */
	async listInScopes(
		scopeIds: readonly string[],
		filter: {
			status?: ReviewStatus;
			submittedBy?: string;
			limit?: number;
		} = {},
	) {
		if (!scopeIds.length) return [];
		const rows = await db
			.select({
				review: reviews,
				submitterName: users.name,
				submitterFamilyName: users.familyName,
			})
			.from(reviews)
			.innerJoin(users, eq(users.id, reviews.submittedBy))
			.where(
				and(
					inArray(reviews.scopeId, [...scopeIds]),
					filter.status ? eq(reviews.status, filter.status) : undefined,
					filter.submittedBy
						? eq(reviews.submittedBy, filter.submittedBy)
						: undefined,
				),
			)
			.orderBy(desc(reviews.createdAt))
			.limit(filter.limit ?? 200);
		return rows.map((r) => ({
			...r.review,
			submitterName: `${r.submitterName} ${r.submitterFamilyName}`.trim(),
		}));
	},
};

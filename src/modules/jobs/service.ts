import { and, asc, desc, eq, gt, gte, lt, or } from "drizzle-orm";
import {
	db,
	decodeCursor,
	type PageDirection,
	type PublicUser,
	paginateRows,
	publicUserColumns,
	publicUserSelect,
	sanitizeRichHtml,
	users as usersTable,
} from "~/core";
import type { InsertJob, Job, UpdateJob } from "./schema";
import { insertJobSchema, jobs, updateJobSchema } from "./schema";

export type JobWithUser = Job & { user: PublicUser };

export const jobsService = {
	/** Every job, or only those owned by `scopeIds` (an admin scope's subtree). */
	async getAll(scopeIds: string[] | null = null): Promise<JobWithUser[]> {
		const rows = await db.query.jobs.findMany({
			where: scopeIds ? { scopeId: { in: scopeIds } } : undefined,
			orderBy: { createdAt: "desc" },
			with: { user: { columns: publicUserColumns } },
		});
		return rows as JobWithUser[];
	},

	async getPending(): Promise<JobWithUser[]> {
		const rows = await db.query.jobs.findMany({
			where: { status: "pending" },
			orderBy: { createdAt: "desc" },
			with: { user: { columns: publicUserColumns } },
		});
		return rows as JobWithUser[];
	},

	async getApproved(): Promise<JobWithUser[]> {
		const now = new Date().toISOString();
		const rows = await db.query.jobs.findMany({
			where: { status: "approved" },
			orderBy: { createdAt: "desc" },
			with: { user: { columns: publicUserColumns } },
		});
		// Filter out expired in-memory (expiresAt >= now)
		return (rows as JobWithUser[]).filter((j) => j.expiresAt >= now);
	},

	async getApprovedPaged(
		limit: number = 10,
		cursor?: string | null,
		direction: PageDirection = "forward",
	): Promise<{
		items: JobWithUser[];
		nextCursor: string | null;
		prevCursor: string | null;
	}> {
		const now = new Date().toISOString();
		const cursorObj = decodeCursor(cursor ?? null);

		const baseCondition = and(
			eq(jobs.status, "approved"),
			gte(jobs.expiresAt, now),
		);

		const boundary = cursorObj
			? direction === "forward"
				? or(
						lt(jobs.createdAt, cursorObj.createdAt),
						and(
							eq(jobs.createdAt, cursorObj.createdAt),
							lt(jobs.id, cursorObj.id),
						),
					)
				: or(
						gt(jobs.createdAt, cursorObj.createdAt),
						and(
							eq(jobs.createdAt, cursorObj.createdAt),
							gte(jobs.id, cursorObj.id),
						),
					)
			: undefined;

		const rows = await db
			.select({ job: jobs, user: publicUserSelect })
			.from(jobs)
			.leftJoin(usersTable, eq(jobs.suggestedBy, usersTable.id))
			.where(boundary ? and(baseCondition, boundary) : baseCondition)
			.orderBy(
				direction === "forward" ? desc(jobs.createdAt) : asc(jobs.createdAt),
				direction === "forward" ? desc(jobs.id) : asc(jobs.id),
			)
			.limit(limit + 1);

		const mapped = rows.map((r) => ({
			...r.job,
			user: r.user!,
		})) as JobWithUser[];
		return paginateRows(
			mapped,
			["createdAt", "id"],
			limit,
			direction,
			cursor ?? null,
		);
	},

	async getById(id: string): Promise<JobWithUser | undefined> {
		const row = await db.query.jobs.findFirst({
			where: { id },
			with: { user: { columns: publicUserColumns } },
		});
		return row as JobWithUser | undefined;
	},

	async getByUser(userId: string): Promise<Job[]> {
		return db.query.jobs.findMany({
			where: { suggestedBy: userId },
			orderBy: { createdAt: "desc" },
		});
	},

	async create(data: InsertJob): Promise<Job> {
		const validated = insertJobSchema.parse(data);
		// body is BlockNote HTML submitted via a hidden input — sanitize before storing
		// since it is later rendered with dangerouslySetInnerHTML.
		if (typeof validated.body === "string") {
			validated.body = sanitizeRichHtml(validated.body);
		}
		const rows = await db
			.insert(jobs)
			.values(validated as any)
			.returning();
		return rows[0];
	},

	async update(id: string, data: UpdateJob): Promise<Job> {
		const validated = updateJobSchema.parse(data);
		if (typeof validated.body === "string") {
			validated.body = sanitizeRichHtml(validated.body);
		}
		const rows = await db
			.update(jobs)
			.set({ ...validated, updatedAt: new Date().toISOString() } as any)
			.where(eq(jobs.id, id))
			.returning();
		return rows[0];
	},

	async delete(id: string): Promise<void> {
		await db.delete(jobs).where(eq(jobs.id, id));
	},
};

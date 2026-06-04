import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "~/db/connection";
import { jobs, insertJobSchema, updateJobSchema } from "~/db/schemas/jobs";
import type { Job, InsertJob, UpdateJob } from "~/db/schemas/jobs";
import type { User } from "~/db/schemas/users";

export type JobWithUser = Job & { user: User };

export const jobsService = {
  async getAll(): Promise<JobWithUser[]> {
    const rows = await db.query.jobs.findMany({
      orderBy: { createdAt: "desc" },
      with: { user: true },
    });
    return rows as JobWithUser[];
  },

  async getPending(): Promise<JobWithUser[]> {
    const rows = await db.query.jobs.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      with: { user: true },
    });
    return rows as JobWithUser[];
  },

  async getApproved(): Promise<JobWithUser[]> {
    const now = new Date().toISOString();
    const rows = await db.query.jobs.findMany({
      where: { status: "approved" },
      orderBy: { createdAt: "desc" },
      with: { user: true },
    });
    // Filter out expired in-memory (expiresAt >= now)
    return (rows as JobWithUser[]).filter((j) => j.expiresAt >= now);
  },

  async getById(id: string): Promise<JobWithUser | undefined> {
    const row = await db.query.jobs.findFirst({
      where: { id },
      with: { user: true },
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
    const rows = await db.insert(jobs).values(validated as any).returning();
    return rows[0];
  },

  async update(id: string, data: UpdateJob): Promise<Job> {
    const validated = updateJobSchema.parse(data);
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

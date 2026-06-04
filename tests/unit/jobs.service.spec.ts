import { describe, it, expect, afterEach } from "vitest";
import { jobsService } from "~/services/jobs.service";
import { createTestUser, openDb } from "./helpers";

const cleanupJobIds: string[] = [];
let cleanupUser: (() => void) | null = null;

afterEach(() => {
  const db = openDb();
  for (const id of cleanupJobIds.splice(0)) {
    db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  }
  db.close();
  cleanupUser?.();
  cleanupUser = null;
});

function makeJobData(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    title: "Software Engineer",
    body: "<p>Great role</p>",
    locationType: "on-site",
    city: "Berlin",
    country: "Germany",
    expiresAt: new Date(Date.now() + 14 * 86400000),
    suggestedBy: userId,
    ...overrides,
  } as any;
}

describe("jobsService.create", () => {
  it("creates a job with status pending by default", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const job = await jobsService.create(makeJobData(userId));
    cleanupJobIds.push(job.id);

    expect(job.status).toBe("pending");
    expect(job.title).toBe("Software Engineer");
    expect(job.suggestedBy).toBe(userId);
  });
});

describe("jobsService.getById", () => {
  it("returns the job with the user attached", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const job = await jobsService.create(makeJobData(userId));
    cleanupJobIds.push(job.id);

    const fetched = await jobsService.getById(job.id);
    expect(fetched).toBeTruthy();
    expect(fetched!.id).toBe(job.id);
    expect(fetched!.user).toBeTruthy();
    expect(fetched!.user.id).toBe(userId);
  });

  it("returns undefined for a non-existent id", async () => {
    const result = await jobsService.getById("00000000-0000-0000-0000-000000000000");
    expect(result).toBeUndefined();
  });
});

describe("jobsService.getByUser", () => {
  it("returns all jobs for a given user regardless of status", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const j1 = await jobsService.create(makeJobData(userId, { title: "Job A" }));
    const j2 = await jobsService.create(makeJobData(userId, { title: "Job B", status: "approved" }));
    cleanupJobIds.push(j1.id, j2.id);

    const jobs = await jobsService.getByUser(userId);
    const ids = jobs.map((j) => j.id);
    expect(ids).toContain(j1.id);
    expect(ids).toContain(j2.id);
  });

  it("does not return jobs belonging to another user", async () => {
    const a = createTestUser();
    const b = createTestUser();
    cleanupUser = () => { a.cleanup(); b.cleanup(); };

    const job = await jobsService.create(makeJobData(a.userId));
    cleanupJobIds.push(job.id);

    const jobs = await jobsService.getByUser(b.userId);
    expect(jobs.map((j) => j.id)).not.toContain(job.id);
  });
});

describe("jobsService.getApproved", () => {
  it("returns approved non-expired jobs", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const job = await jobsService.create(
      makeJobData(userId, { status: "approved" }),
    );
    cleanupJobIds.push(job.id);

    const approved = await jobsService.getApproved();
    expect(approved.map((j) => j.id)).toContain(job.id);
  });

  it("excludes pending jobs", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const job = await jobsService.create(makeJobData(userId, { status: "pending" }));
    cleanupJobIds.push(job.id);

    const approved = await jobsService.getApproved();
    expect(approved.map((j) => j.id)).not.toContain(job.id);
  });

  it("excludes expired jobs even if approved", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const job = await jobsService.create(
      makeJobData(userId, {
        status: "approved",
        expiresAt: new Date(Date.now() - 86400000), // yesterday
      }),
    );
    cleanupJobIds.push(job.id);

    const approved = await jobsService.getApproved();
    expect(approved.map((j) => j.id)).not.toContain(job.id);
  });
});

describe("jobsService.update", () => {
  it("updates the title", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const job = await jobsService.create(makeJobData(userId));
    cleanupJobIds.push(job.id);

    const updated = await jobsService.update(job.id, { title: "Senior Engineer" });
    expect(updated.title).toBe("Senior Engineer");
  });

  it("can approve a job by setting status to approved", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const job = await jobsService.create(makeJobData(userId));
    cleanupJobIds.push(job.id);

    const updated = await jobsService.update(job.id, { status: "approved" } as any);
    expect(updated.status).toBe("approved");
  });
});

describe("jobsService.delete", () => {
  it("removes the job so getById returns undefined", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const job = await jobsService.create(makeJobData(userId));
    // Don't push to cleanupJobIds — we're testing the delete

    await jobsService.delete(job.id);

    const fetched = await jobsService.getById(job.id);
    expect(fetched).toBeUndefined();
  });
});

import { and, eq, or } from "drizzle-orm";
import { db } from "~/db/connection";
import {
  electionCycles,
  insertElectionCycleSchema,
  updateElectionCycleSchema,
  type ElectionCycle,
} from "~/db/schemas/election-cycles";
import {
  electionPositions,
  insertElectionPositionSchema,
  updateElectionPositionSchema,
  type ElectionPosition,
} from "~/db/schemas/election-positions";
import {
  electionApplications,
  insertElectionApplicationSchema,
  type ElectionApplication,
} from "~/db/schemas/election-applications";
import { membershipsService } from "./memberships.service";
import { users } from "~/db/schemas/users";
import type { User } from "~/db/schemas/users";
import crypto from "crypto";

const CYCLE_STATUS_RANK: Record<string, number> = {
  draft: 0,
  open: 1,
  voting: 2,
  closed: 3,
};

export type ElectionCycleWithPositions = ElectionCycle & {
  positions: ElectionPosition[];
};

export type ElectionApplicationWithUser = ElectionApplication & {
  user: User;
};

export type ElectionApplicationWithDetails = ElectionApplication & {
  user: User;
  position: ElectionPosition;
  cycle: ElectionCycle;
};

export type ElectionApplicationPublic = Omit<ElectionApplication, "adminNote"> & {
  user: User;
  position: ElectionPosition;
};

export const electionsService = {
  // Cycles

  async getCycles(): Promise<ElectionCycle[]> {
    return db.query.electionCycles.findMany({
      orderBy: { year: "desc" },
    });
  },

  async getPublicCycles(): Promise<ElectionCycle[]> {
    return db
      .select()
      .from(electionCycles)
      .where(
        or(
          eq(electionCycles.status, "open"),
          eq(electionCycles.status, "voting"),
          eq(electionCycles.status, "closed"),
        ),
      )
      .orderBy(electionCycles.year) as Promise<ElectionCycle[]>;
  },

  async getCycleById(id: string): Promise<ElectionCycleWithPositions | undefined> {
    const row = await db.query.electionCycles.findFirst({
      where: { id },
      with: { positions: true },
    });
    return row as ElectionCycleWithPositions | undefined;
  },

  async createCycle(data: {
    title: string;
    year: number;
    description?: string;
    requiredMembershipTier?: "associated" | "full" | null;
  }): Promise<ElectionCycle> {
    const validated = insertElectionCycleSchema.parse({
      id: crypto.randomUUID(),
      ...data,
    });
    const [row] = await db
      .insert(electionCycles)
      .values(validated as any)
      .returning();
    return row;
  },

  async updateCycle(
    id: string,
    data: Partial<{
      title: string;
      year: number;
      description: string | null;
      status: "draft" | "open" | "voting" | "closed";
      requiredMembershipTier: "associated" | "full" | null;
      votingUrl: string | null;
    }>,
  ): Promise<ElectionCycle> {
    if (data.status) {
      const current = await db.query.electionCycles.findFirst({ where: { id } });
      if (!current) throw new Error(`Cycle ${id} not found`);
      const currentRank = CYCLE_STATUS_RANK[current.status] ?? 0;
      const newRank = CYCLE_STATUS_RANK[data.status] ?? 0;
      if (newRank < currentRank) {
        throw new Error(
          `Cannot move cycle status backwards (${current.status} → ${data.status})`,
        );
      }
    }
    const validated = updateElectionCycleSchema.parse(data);
    const [row] = await db
      .update(electionCycles)
      .set({ ...validated, updatedAt: new Date().toISOString() } as any)
      .where(eq(electionCycles.id, id))
      .returning();
    return row;
  },

  // Positions

  async getPositionsByCycle(cycleId: string): Promise<ElectionPosition[]> {
    return db.query.electionPositions.findMany({
      where: { cycleId },
      orderBy: { createdAt: "asc" },
    });
  },

  async createPosition(data: {
    cycleId: string;
    title: string;
    description?: string;
    maxCandidates?: number;
  }): Promise<ElectionPosition> {
    const validated = insertElectionPositionSchema.parse({
      id: crypto.randomUUID(),
      ...data,
    });
    const [row] = await db
      .insert(electionPositions)
      .values(validated as any)
      .returning();
    return row;
  },

  async updatePosition(
    id: string,
    data: Partial<{ title: string; description: string | null; maxCandidates: number | null }>,
  ): Promise<ElectionPosition> {
    const validated = updateElectionPositionSchema.parse(data);
    const [row] = await db
      .update(electionPositions)
      .set(validated as any)
      .where(eq(electionPositions.id, id))
      .returning();
    return row;
  },

  async deletePosition(id: string): Promise<{ error?: string }> {
    const position = await db.query.electionPositions.findFirst({
      where: { id },
      with: { cycle: true },
    });
    if (!position) return {};
    if ((position as any).cycle?.status !== "draft") {
      return { error: "Positions can only be deleted while the cycle is in draft" };
    }
    await db.delete(electionPositions).where(eq(electionPositions.id, id));
    return {};
  },

  // Applications

  async getApplicationsByCycle(
    cycleId: string,
  ): Promise<ElectionApplicationWithUser[]> {
    const rows = await db.query.electionApplications.findMany({
      where: { cycleId },
      orderBy: { createdAt: "asc" },
      with: { user: true, position: true },
    });
    return rows as ElectionApplicationWithUser[];
  },

  async getApprovedApplicationsByCycle(
    cycleId: string,
  ): Promise<ElectionApplicationPublic[]> {
    const rows = await db.query.electionApplications.findMany({
      where: { cycleId },
      orderBy: { createdAt: "asc" },
      with: { user: true, position: true },
    });
    return (rows as any[])
      .filter((r) => r.status === "approved")
      .map(({ adminNote: _omit, ...rest }) => rest);
  },

  async getApplicationsByUser(
    userId: string,
  ): Promise<ElectionApplicationWithDetails[]> {
    const rows = await db.query.electionApplications.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      with: { position: true, cycle: true },
    });
    return rows as ElectionApplicationWithDetails[];
  },

  async getApplicationById(
    id: string,
  ): Promise<ElectionApplication | undefined> {
    return db.query.electionApplications.findFirst({ where: { id } });
  },

  async createApplication(data: {
    positionId: string;
    cycleId: string;
    userId: string;
    motivationWhy: string;
    motivationExperience: string;
    motivationGoals: string;
  }): Promise<{ application?: ElectionApplication; error?: string }> {
    const cycle = await db.query.electionCycles.findFirst({
      where: { id: data.cycleId },
    });
    if (!cycle) return { error: "Election cycle not found" };
    if (cycle.status !== "open") return { error: "This election is not open for applications" };

    if (cycle.requiredMembershipTier) {
      const hasAccess = await membershipsService.hasTier(
        data.userId,
        cycle.requiredMembershipTier,
      );
      if (!hasAccess) {
        const tierLabel =
          cycle.requiredMembershipTier === "full" ? "Full Member" : "Associated Member";
        return { error: `You need at least ${tierLabel} status to apply for this election` };
      }
    }

    const [duplicate] = await db
      .select()
      .from(electionApplications)
      .where(
        and(
          eq(electionApplications.positionId, data.positionId),
          eq(electionApplications.userId, data.userId),
        ),
      )
      .limit(1);
    if (duplicate) return { error: "You have already applied for this position" };

    const validated = insertElectionApplicationSchema.parse({
      id: crypto.randomUUID(),
      ...data,
    });
    const [row] = await db
      .insert(electionApplications)
      .values(validated as any)
      .returning();
    return { application: row };
  },

  async updateApplicationStatus(
    id: string,
    status: "approved" | "rejected",
    adminNote?: string,
  ): Promise<ElectionApplication> {
    const [row] = await db
      .update(electionApplications)
      .set({
        status,
        adminNote: adminNote ?? null,
        updatedAt: new Date().toISOString(),
      } as any)
      .where(eq(electionApplications.id, id))
      .returning();
    return row;
  },

  async deleteApplication(id: string): Promise<void> {
    await db
      .delete(electionApplications)
      .where(eq(electionApplications.id, id));
  },
};

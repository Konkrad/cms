import crypto from "crypto";
import { and, eq, inArray, like, ne, or } from "drizzle-orm";
import {
	type ContentFilter,
	db,
	membershipsService,
	type PublicUser,
	publicUserColumns,
	t,
} from "~/core";
import {
	type ElectionApplication,
	type ElectionCycle,
	type ElectionPosition,
	electionApplications,
	electionCycles,
	electionPositions,
	insertElectionApplicationSchema,
	insertElectionCycleSchema,
	insertElectionPositionSchema,
	updateElectionCycleSchema,
	updateElectionPositionSchema,
} from "./schema";

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
	user: PublicUser;
};

export type ElectionApplicationWithDetails = ElectionApplication & {
	user: PublicUser;
	position: ElectionPosition;
	cycle: ElectionCycle;
};

export type ElectionApplicationPublic = Omit<
	ElectionApplication,
	"adminNote"
> & {
	user: PublicUser;
	position: ElectionPosition;
};

export const electionsService = {
	/** Owning scope of the election cycles with these ids (reference resolution). */
	async locate(
		ids: readonly string[],
	): Promise<Array<{ id: string; scopeId: string; title: string }>> {
		if (!ids.length) return [];
		return db
			.select({
				id: electionCycles.id,
				scopeId: electionCycles.scopeId,
				title: electionCycles.title,
			})
			.from(electionCycles)
			.where(inArray(electionCycles.id, [...ids]));
	},

	/** Published (not draft) cycles whose title contains `query` (admin link picker). */
	async searchPublished(
		query: string,
		limit: number,
	): Promise<Array<{ id: string; scopeId: string; title: string }>> {
		return db
			.select({
				id: electionCycles.id,
				scopeId: electionCycles.scopeId,
				title: electionCycles.title,
			})
			.from(electionCycles)
			.where(
				and(
					ne(electionCycles.status, "draft"),
					like(electionCycles.title, `%${query}%`),
				),
			)
			.limit(limit);
	},

	// Cycles

	/** Every cycle, or only those owned by `scopeIds` (an admin scope's subtree). */
	async getCycles(scopeIds: string[] | null = null): Promise<ElectionCycle[]> {
		return db.query.electionCycles.findMany({
			where: scopeIds ? { scopeId: { in: scopeIds } } : undefined,
			orderBy: { year: "desc" },
		});
	},

	/** Non-draft cycles of a listing (`scopeContentFilter`), oldest year first. */
	async getPublicCycles(filter: ContentFilter): Promise<ElectionCycle[]> {
		return db
			.select()
			.from(electionCycles)
			.where(
				and(
					or(
						eq(electionCycles.status, "open"),
						eq(electionCycles.status, "voting"),
						eq(electionCycles.status, "closed"),
					),
					filter.where(electionCycles),
				),
			)
			.orderBy(electionCycles.year) as Promise<ElectionCycle[]>;
	},

	async getCycleById(
		id: string,
	): Promise<ElectionCycleWithPositions | undefined> {
		const row = await db.query.electionCycles.findFirst({
			where: { id },
			with: { positions: true },
		});
		return row as ElectionCycleWithPositions | undefined;
	},

	/**
	 * The owning scope of a cycle, or of the cycle of a position or application; undefined when
	 * the row does not exist. For the admin scope checks of actions that take such an id.
	 */
	async scopeOf(ref: {
		cycleId?: string;
		positionId?: string;
		applicationId?: string;
	}): Promise<{ scopeId: string } | undefined> {
		let cycleId = ref.cycleId;
		if (ref.positionId) {
			cycleId = (
				await db.query.electionPositions.findFirst({
					where: { id: ref.positionId },
				})
			)?.cycleId;
		} else if (ref.applicationId) {
			cycleId = (
				await db.query.electionApplications.findFirst({
					where: { id: ref.applicationId },
				})
			)?.cycleId;
		}
		if (!cycleId) return undefined;
		const cycle = await db.query.electionCycles.findFirst({
			where: { id: cycleId },
		});
		return cycle ? { scopeId: cycle.scopeId } : undefined;
	},

	async createCycle(data: {
		scopeId: string;
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
			const current = await db.query.electionCycles.findFirst({
				where: { id },
			});
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
		data: Partial<{
			title: string;
			description: string | null;
			maxCandidates: number | null;
		}>,
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
			return {
				error: t("elections.service.positionsCanOnlyBeDeleted"),
			};
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
			with: { user: { columns: publicUserColumns }, position: true },
		});
		return rows as ElectionApplicationWithUser[];
	},

	async getApprovedApplicationsByCycle(
		cycleId: string,
	): Promise<ElectionApplicationPublic[]> {
		const rows = await db.query.electionApplications.findMany({
			where: { cycleId },
			orderBy: { createdAt: "asc" },
			with: { user: { columns: publicUserColumns }, position: true },
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
		if (!cycle) return { error: t("elections.service.electionCycleNotFound") };
		if (cycle.status !== "open")
			return { error: t("elections.service.thisElectionIsNotOpen") };

		// The position id comes from the client: it must belong to the cycle whose status and
		// tier gate were just checked, otherwise those checks could be sidestepped.
		const position = await db.query.electionPositions.findFirst({
			where: { id: data.positionId },
		});
		if (!position || position.cycleId !== data.cycleId) {
			return { error: t("elections.service.positionNotFoundInThis") };
		}

		if (cycle.requiredMembershipTier) {
			const hasAccess = await membershipsService.hasTier(
				data.userId,
				cycle.requiredMembershipTier,
			);
			if (!hasAccess) {
				const tierLabel =
					cycle.requiredMembershipTier === "full"
						? t("elections.service.fullMember")
						: t("elections.service.associatedMember");
				return {
					error: t("elections.service.youNeedAtLeastStatus", { tierLabel }),
				};
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
		if (duplicate)
			return { error: t("elections.service.youHaveAlreadyAppliedFor") };

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

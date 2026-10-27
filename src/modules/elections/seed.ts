/**
 * E2E fixtures of the elections module (manifest `seed`, run by scripts/seed-test.ts after core
 * while the module is active): the 2024 board elections (closed) and 2026 (open). No demo data.
 * Loaded lazily.
 */
import { type SeedContext, seedPeople } from "~/core";

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export async function seedElections(ctx: SeedContext): Promise<void> {
	if (ctx.mode !== "test") return;
	const { db, schema } = ctx;
	const rootScope = { id: ctx.rootScopeId };
	const { admin: adminUser, testUsers } = seedPeople(ctx);

	// ─── Elections ────────────────────────────────────────────────────────────────

	const electionCycleDefs: Array<{
		title: string;
		year: number;
		description: string;
		status: "draft" | "open" | "closed";
		requiredMembershipTier: "associated" | "full" | null;
	}> = [
		{
			title: "Board Elections 2024",
			year: 2024,
			description: "Annual board elections for the 2024–2026 term.",
			status: "closed",
			requiredMembershipTier: "full",
		},
		{
			title: "Board Elections 2026",
			year: 2026,
			description:
				"Nominations are open for the 2026–2028 board term. Full members may apply.",
			status: "open",
			requiredMembershipTier: "full",
		},
	];

	const existingCycles = db.select().from(schema.electionCycles).all();
	const cycleIdByTitle: Record<string, string> = {};

	for (const c of electionCycleDefs) {
		const existing = existingCycles.find((ec) => ec.title === c.title);
		if (existing) {
			cycleIdByTitle[c.title] = existing.id;
		} else {
			const id = uuid();
			db.insert(schema.electionCycles)
				.values({
					id,
					scopeId: rootScope.id,
					title: c.title,
					year: c.year,
					description: c.description,
					status: c.status,
					requiredMembershipTier: c.requiredMembershipTier,
					createdAt: now(),
					updatedAt: now(),
				})
				.run();
			cycleIdByTitle[c.title] = id;
		}
	}

	const positionDefs: Array<{
		cycleTitle: string;
		title: string;
		description: string;
	}> = [
		{
			cycleTitle: "Board Elections 2024",
			title: "Board President",
			description: "Leads the board and chairs meetings.",
		},
		{
			cycleTitle: "Board Elections 2024",
			title: "Secretary",
			description: "Manages communication and minutes.",
		},
		{
			cycleTitle: "Board Elections 2026",
			title: "Board President",
			description: "Leads the board and chairs meetings.",
		},
		{
			cycleTitle: "Board Elections 2026",
			title: "Treasurer",
			description: "Oversees finances and budgeting.",
		},
		{
			cycleTitle: "Board Elections 2026",
			title: "Secretary",
			description: "Manages communication and minutes.",
		},
	];

	const existingPositions = db.select().from(schema.electionPositions).all();
	const positionIdByKey: Record<string, string> = {};

	for (const p of positionDefs) {
		const cycleId = cycleIdByTitle[p.cycleTitle];
		if (!cycleId) continue;
		const key = `${p.cycleTitle}::${p.title}`;
		const existing = existingPositions.find(
			(ep) => ep.cycleId === cycleId && ep.title === p.title,
		);
		if (existing) {
			positionIdByKey[key] = existing.id;
		} else {
			const id = uuid();
			db.insert(schema.electionPositions)
				.values({
					id,
					cycleId,
					title: p.title,
					description: p.description,
					createdAt: now(),
				})
				.run();
			positionIdByKey[key] = id;
		}
	}

	const applicationDefs: Array<{
		cycleTitle: string;
		positionTitle: string;
		userIdx: number;
		status: "pending" | "approved" | "rejected";
		adminNote?: string;
	}> = [
		{
			cycleTitle: "Board Elections 2024",
			positionTitle: "Board President",
			userIdx: 0,
			status: "approved",
		},
		{
			cycleTitle: "Board Elections 2024",
			positionTitle: "Secretary",
			userIdx: 2,
			status: "approved",
		},
		{
			cycleTitle: "Board Elections 2024",
			positionTitle: "Secretary",
			userIdx: 6,
			status: "rejected",
			adminNote: "Withdrew candidacy before vote.",
		},
		{
			cycleTitle: "Board Elections 2026",
			positionTitle: "Board President",
			userIdx: 0,
			status: "pending",
		},
		{
			cycleTitle: "Board Elections 2026",
			positionTitle: "Board President",
			userIdx: 2,
			status: "pending",
		},
		{
			cycleTitle: "Board Elections 2026",
			positionTitle: "Treasurer",
			userIdx: 1,
			status: "approved",
		},
		{
			cycleTitle: "Board Elections 2026",
			positionTitle: "Secretary",
			userIdx: 6,
			status: "approved",
		},
		{
			cycleTitle: "Board Elections 2026",
			positionTitle: "Secretary",
			userIdx: -1,
			status: "rejected",
			adminNote:
				"Admin cannot serve on the board while also administering the platform.",
		},
	];

	const existingApplications = db
		.select()
		.from(schema.electionApplications)
		.all();

	for (const a of applicationDefs) {
		const cycleId = cycleIdByTitle[a.cycleTitle];
		const positionId = positionIdByKey[`${a.cycleTitle}::${a.positionTitle}`];
		const userId = a.userIdx === -1 ? adminUser.id : testUsers[a.userIdx]?.id;
		if (!cycleId || !positionId || !userId) continue;
		const exists = existingApplications.find(
			(ea) => ea.positionId === positionId && ea.userId === userId,
		);
		if (exists) continue;
		db.insert(schema.electionApplications)
			.values({
				id: uuid(),
				positionId,
				cycleId,
				userId,
				status: a.status,
				motivationWhy:
					"I am passionate about the community and believe I can contribute meaningfully to its direction and growth.",
				motivationExperience:
					"I have been an active member for several years and have organised multiple events across different cities.",
				motivationGoals:
					"I want to strengthen member engagement, improve transparency in decision-making, and grow our local chapters.",
				adminNote: a.adminNote ?? null,
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
	}

	const cycleCount = db.select().from(schema.electionCycles).all().length;
	const posCount = db.select().from(schema.electionPositions).all().length;
	const appCount = db.select().from(schema.electionApplications).all().length;
	console.log(
		`  elections seeded (${cycleCount} cycles, ${posCount} positions, ${appCount} applications)`,
	);
}

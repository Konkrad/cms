/**
 * Demo data of the qualifications module (manifest `seed`, run by scripts/seed.ts after core while
 * the module is active): qualification types and user qualifications, with the memberships and
 * tags an approved qualification grants. No e2e fixtures (specs create their own). Loaded lazily.
 */
import { eq } from "drizzle-orm";
import { type SeedContext, seedPeople } from "~/core";

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export async function seedQualifications(ctx: SeedContext): Promise<void> {
	if (ctx.mode !== "demo") return;
	const { db, schema } = ctx;
	const rootScope = { id: ctx.rootScopeId };
	const { admin: adminUser, testUsers } = seedPeople(ctx);

	// ─── 18. Qualification types ─────────────────────────────────────────────────

	const qualTypeDefs = [
		{
			slug: "master-school",
			label: "Master School Graduate",
			description: "Completed our master-level programme.",
			grantsMembershipTier: "full" as const,
		},
		{
			slug: "summer-school",
			label: "Summer School Graduate",
			description: "Completed our summer school programme.",
			grantsMembershipTier: "associated" as const,
		},
		{
			slug: "phd",
			label: "PhD",
			description: "Holds a doctoral degree.",
			grantsMembershipTier: "full" as const,
		},
		{
			slug: "former-employee",
			label: "Former Employee",
			description: "Previously worked at the organisation.",
			grantsMembershipTier: "associated" as const,
		},
	];

	const existingQualTypes = db.select().from(schema.qualificationTypes).all();
	const qualTypeIdBySlug: Record<string, string> = {};

	for (const qt of qualTypeDefs) {
		const existing = existingQualTypes.find((q) => q.slug === qt.slug);
		if (existing) {
			qualTypeIdBySlug[qt.slug] = existing.id;
		} else {
			const id = uuid();
			db.insert(schema.qualificationTypes)
				.values({
					id,
					scopeId: rootScope.id,
					slug: qt.slug,
					label: qt.label,
					description: qt.description,
					grantsMembershipTier: qt.grantsMembershipTier,
					createdAt: now(),
					updatedAt: now(),
				})
				.run();
			qualTypeIdBySlug[qt.slug] = id;
			console.log(`  created qualification type '${qt.slug}'`);
		}
	}
	console.log(`  qualification types seeded (${qualTypeDefs.length})`);

	// ─── 19. User qualifications, memberships & tags ──────────────────────────────

	// Maps: userIdx (-1=admin) → { typeSlug, status, notes? }
	const qualificationPlan: Array<{
		userIdx: number;
		typeSlug: string;
		status: "pending" | "approved" | "rejected";
		notes?: string;
	}> = [
		{ userIdx: 0, typeSlug: "master-school", status: "approved" },
		{ userIdx: 1, typeSlug: "summer-school", status: "approved" },
		{ userIdx: 2, typeSlug: "phd", status: "approved" },
		{ userIdx: 3, typeSlug: "summer-school", status: "pending" },
		{ userIdx: 4, typeSlug: "phd", status: "pending" },
		{
			userIdx: 5,
			typeSlug: "master-school",
			status: "rejected",
			notes: "Could not verify the transcript submitted.",
		},
		{ userIdx: 6, typeSlug: "former-employee", status: "approved" },
		{ userIdx: 7, typeSlug: "summer-school", status: "approved" },
		{ userIdx: -1, typeSlug: "master-school", status: "approved" },
	];

	const existingQuals = db.select().from(schema.userQualifications).all();
	const existingMembershipRows = db.select().from(schema.userMemberships).all();
	const existingTagRows = db.select().from(schema.userTags).all();

	// Tier hierarchy for upgrade-only logic
	const tierRank: Record<string, number> = { associated: 1, full: 2 };

	for (const plan of qualificationPlan) {
		const userId =
			plan.userIdx === -1 ? adminUser.id : testUsers[plan.userIdx]?.id;
		if (!userId) continue;
		const typeId = qualTypeIdBySlug[plan.typeSlug];
		if (!typeId) continue;

		// Upsert qualification
		const exists = existingQuals.find(
			(q) => q.userId === userId && q.typeId === typeId,
		);
		let qualId: string;
		if (!exists) {
			qualId = uuid();
			db.insert(schema.userQualifications)
				.values({
					id: qualId,
					userId,
					typeId,
					status: plan.status,
					notes: plan.notes ?? null,
					verifiedBy: plan.status !== "pending" ? adminUser.id : null,
					verifiedAt: plan.status !== "pending" ? now() : null,
					createdAt: now(),
					updatedAt: now(),
				})
				.run();
			// Pending claims wait in the root's Reviews queue.
			if (plan.status === "pending")
				db.insert(schema.reviews)
					.values({
						id: uuid(),
						ref: `qualifications:claim:${qualId}`,
						scopeId: ctx.rootScopeId,
						status: "in_review",
						submittedBy: userId,
						createdAt: now(),
					})
					.run();
		} else {
			qualId = exists.id;
		}

		if (plan.status !== "approved") continue;

		// For approved qualifications: grant membership and tag
		const qualType = qualTypeDefs.find((qt) => qt.slug === plan.typeSlug)!;
		const grantsTier = qualType.grantsMembershipTier;

		// Membership — only upgrade, never downgrade
		const existingMembership =
			existingMembershipRows.find((m) => m.userId === userId) ??
			db
				.select()
				.from(schema.userMemberships)
				.all()
				.find((m) => m.userId === userId);
		const currentRank = existingMembership
			? (tierRank[existingMembership.tier] ?? 0)
			: 0;
		const newRank = tierRank[grantsTier] ?? 0;

		if (newRank > currentRank) {
			if (existingMembership) {
				db.update(schema.userMemberships)
					.set({
						tier: grantsTier,
						grantedBy: adminUser.id,
						grantedAt: now(),
						updatedAt: now(),
					})
					.where(eq(schema.userMemberships.userId, userId))
					.run();
			} else {
				db.insert(schema.userMemberships)
					.values({
						id: uuid(),
						userId,
						tier: grantsTier,
						grantedBy: adminUser.id,
						grantedAt: now(),
						createdAt: now(),
						updatedAt: now(),
					})
					.run();
			}
			// Refresh for subsequent iterations
			existingMembershipRows.push({
				id: "",
				userId,
				tier: grantsTier,
				grantedBy: adminUser.id,
				grantedAt: now(),
				expiresAt: null,
				notes: null,
				createdAt: now(),
				updatedAt: now(),
			});
		}

		// Tag — upsert on (userId, slug)
		const tagExists =
			existingTagRows.find(
				(t) => t.userId === userId && t.slug === plan.typeSlug,
			) ??
			db
				.select()
				.from(schema.userTags)
				.all()
				.find((t) => t.userId === userId && t.slug === plan.typeSlug);
		if (!tagExists) {
			db.insert(schema.userTags)
				.values({
					id: uuid(),
					userId,
					slug: plan.typeSlug,
					label: qualType.label,
					category: "qualification",
					sourceType: "qualification",
					sourceId: qualId,
					grantedBy: adminUser.id,
					grantedAt: now(),
				})
				.run();
		}
	}

	const qualCount = db.select().from(schema.userQualifications).all().length;
	const membershipCount = db.select().from(schema.userMemberships).all().length;
	const tagCount = db.select().from(schema.userTags).all().length;
	console.log(`  user qualifications seeded (${qualCount})`);
	console.log(`  user memberships seeded (${membershipCount})`);
	console.log(`  user tags seeded (${tagCount})`);
}

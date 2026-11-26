import crypto from "crypto";
import { and, eq, inArray, lte } from "drizzle-orm";
import {
	db,
	membershipsService,
	type PublicUser,
	publicUserColumns,
	t,
	userTagsService,
} from "~/core";
import {
	insertQualificationTokenSchema,
	insertQualificationTypeSchema,
	insertUserQualificationSchema,
	type QualificationToken,
	type QualificationType,
	qualificationTokens,
	qualificationTypes,
	type UserQualification,
	updateQualificationTypeSchema,
	userQualifications,
} from "./schema";

export type UserQualificationWithType = UserQualification & {
	type: QualificationType;
};

/** Admin application row: includes the applicant's full users row (strip it before serializing). */
export type UserQualificationWithApplicant = UserQualificationWithType & {
	user: PublicUser;
};

export const qualificationsService = {
	/**
	 * Statistics: how many of these people hold each qualification (approved), by type label,
	 * plus those with none. Counts only; a person with two qualifications counts in both.
	 */
	async countHoldersByType(
		userIds: readonly string[],
	): Promise<Array<{ key: string; label: string; count: number }>> {
		const types = await this.getTypes();
		const holders = new Map<string, Set<string>>();
		const withAny = new Set<string>();
		for (let i = 0; i < userIds.length; i += 500) {
			const rows = await db
				.select({
					userId: userQualifications.userId,
					typeId: userQualifications.typeId,
				})
				.from(userQualifications)
				.where(
					and(
						inArray(userQualifications.userId, userIds.slice(i, i + 500)),
						eq(userQualifications.status, "approved"),
					),
				);
			for (const r of rows) {
				holders.set(
					r.typeId,
					(holders.get(r.typeId) ?? new Set()).add(r.userId),
				);
				withAny.add(r.userId);
			}
		}
		return [
			...types.map((type) => ({
				key: type.id,
				label: type.label,
				count: holders.get(type.id)?.size ?? 0,
			})),
			{
				key: "none",
				label: t("qualifications.statistics.none"),
				count: new Set(userIds).size - withAny.size,
			},
		];
	},

	// Qualification types (admin-managed)

	async getTypes(): Promise<QualificationType[]> {
		return db.query.qualificationTypes.findMany({
			orderBy: { label: "asc" },
		});
	},

	async getTypeById(id: string): Promise<QualificationType | undefined> {
		return db.query.qualificationTypes.findFirst({ where: { id } });
	},

	async createType(data: {
		scopeId: string;
		slug: string;
		label: string;
		description?: string;
		grantsMembershipTier: "associated" | "full";
	}): Promise<QualificationType> {
		const validated = insertQualificationTypeSchema.parse({
			id: crypto.randomUUID(),
			...data,
		});
		const [row] = await db
			.insert(qualificationTypes)
			.values(validated as any)
			.returning();
		return row;
	},

	async updateType(
		id: string,
		data: Partial<{
			slug: string;
			label: string;
			description: string | null;
			grantsMembershipTier: "associated" | "full";
		}>,
	): Promise<QualificationType> {
		const validated = updateQualificationTypeSchema.parse(data);
		const [row] = await db
			.update(qualificationTypes)
			.set({ ...validated, updatedAt: new Date().toISOString() } as any)
			.where(eq(qualificationTypes.id, id))
			.returning();
		return row;
	},

	async deleteType(id: string): Promise<void> {
		await db.delete(qualificationTypes).where(eq(qualificationTypes.id, id));
	},

	// User qualifications

	async getPendingApplications(): Promise<UserQualificationWithApplicant[]> {
		const rows = await db.query.userQualifications.findMany({
			where: { status: "pending" },
			orderBy: { createdAt: "asc" },
			with: { type: true, user: { columns: publicUserColumns } },
		});
		return rows as UserQualificationWithApplicant[];
	},

	async getAllApplications(): Promise<UserQualificationWithApplicant[]> {
		const rows = await db.query.userQualifications.findMany({
			orderBy: { createdAt: "desc" },
			with: { type: true, user: { columns: publicUserColumns } },
		});
		return rows as UserQualificationWithApplicant[];
	},

	async getByUser(userId: string): Promise<UserQualificationWithType[]> {
		const rows = await db.query.userQualifications.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
			with: { type: true },
		});
		return rows as UserQualificationWithType[];
	},

	async getById(id: string): Promise<UserQualificationWithType | undefined> {
		const row = await db.query.userQualifications.findFirst({
			where: { id },
			with: { type: true, user: { columns: publicUserColumns } },
		});
		return row as UserQualificationWithType | undefined;
	},

	/** Claims with these ids, for core's review queue: their type's scope and label. */
	async locateClaims(
		ids: readonly string[],
	): Promise<Array<{ id: string; scopeId: string; label: string }>> {
		if (!ids.length) return [];
		return db
			.select({
				id: userQualifications.id,
				scopeId: qualificationTypes.scopeId,
				label: qualificationTypes.label,
			})
			.from(userQualifications)
			.innerJoin(
				qualificationTypes,
				eq(qualificationTypes.id, userQualifications.typeId),
			)
			.where(inArray(userQualifications.id, [...ids]));
	},

	async upsert(userId: string, typeId: string): Promise<UserQualification> {
		const [existing] = await db
			.select()
			.from(userQualifications)
			.where(
				and(
					eq(userQualifications.userId, userId),
					eq(userQualifications.typeId, typeId),
				),
			)
			.limit(1);

		if (existing) {
			// Allow re-applying after rejection — reset to pending
			if (existing.status === "rejected") {
				const [row] = await db
					.update(userQualifications)
					.set({
						status: "pending",
						notes: null,
						verifiedBy: null,
						verifiedAt: null,
						updatedAt: new Date().toISOString(),
					} as any)
					.where(eq(userQualifications.id, existing.id))
					.returning();
				return row;
			}
			return existing;
		}

		const validated = insertUserQualificationSchema.parse({
			id: crypto.randomUUID(),
			userId,
			typeId,
		});
		const [row] = await db
			.insert(userQualifications)
			.values(validated as any)
			.returning();
		return row;
	},

	async approve(
		id: string,
		adminUserId: string,
		notes?: string,
	): Promise<UserQualification> {
		const qual = await this.getById(id);
		if (!qual) throw new Error(`Qualification ${id} not found`);

		const [row] = await db
			.update(userQualifications)
			.set({
				status: "approved",
				verifiedBy: adminUserId,
				verifiedAt: new Date().toISOString(),
				notes: notes ?? null,
				updatedAt: new Date().toISOString(),
			} as any)
			.where(eq(userQualifications.id, id))
			.returning();

		await membershipsService.upgradeIfHigher(
			qual.userId,
			qual.type.grantsMembershipTier,
		);

		await userTagsService.grant(
			qual.userId,
			qual.type.slug,
			qual.type.label,
			"qualification",
			"qualification",
			id,
		);

		return row;
	},

	async reject(
		id: string,
		adminUserId: string,
		notes: string,
	): Promise<UserQualification> {
		const [row] = await db
			.update(userQualifications)
			.set({
				status: "rejected",
				verifiedBy: adminUserId,
				verifiedAt: new Date().toISOString(),
				notes,
				updatedAt: new Date().toISOString(),
			} as any)
			.where(eq(userQualifications.id, id))
			.returning();
		return row;
	},

	// ── Verification tokens ────────────────────────────────────────────────────

	async createToken(
		typeId: string,
		adminUserId: string,
		expiresInHours: number,
	): Promise<QualificationToken> {
		const expiresAt = new Date(
			Date.now() + expiresInHours * 3_600_000,
		).toISOString();
		const validated = insertQualificationTokenSchema.parse({
			typeId,
			createdBy: adminUserId,
			expiresAt,
		});
		const [row] = await db
			.insert(qualificationTokens)
			.values(validated as any)
			.returning();
		return row;
	},

	async getActiveTokensForType(typeId: string): Promise<QualificationToken[]> {
		const now = new Date().toISOString();
		return db
			.select()
			.from(qualificationTokens)
			.where(
				and(
					eq(qualificationTokens.typeId, typeId),
					eq(qualificationTokens.isActive, true),
				),
			)
			.orderBy(qualificationTokens.createdAt) as Promise<QualificationToken[]>;
	},

	async revokeToken(tokenId: string): Promise<void> {
		await db
			.update(qualificationTokens)
			.set({ isActive: false } as any)
			.where(eq(qualificationTokens.id, tokenId));
	},

	async redeemToken(
		token: string,
		userId: string,
	): Promise<{ success: boolean; alreadyVerified?: boolean; error?: string }> {
		const now = new Date().toISOString();

		const [tokenRow] = await db
			.select()
			.from(qualificationTokens)
			.where(eq(qualificationTokens.token, token))
			.limit(1);

		if (!tokenRow)
			return {
				success: false,
				error: t("qualifications.service.invalidOrUnknownToken"),
			};
		if (!tokenRow.isActive)
			return {
				success: false,
				error: t("qualifications.service.thisQrCodeHasBeen"),
			};
		if (tokenRow.expiresAt < now)
			return {
				success: false,
				error: t("qualifications.service.thisQrCodeHasExpired"),
			};

		// Check if already approved
		const [existing] = await db
			.select()
			.from(userQualifications)
			.where(
				and(
					eq(userQualifications.userId, userId),
					eq(userQualifications.typeId, tokenRow.typeId),
				),
			)
			.limit(1);

		if (existing?.status === "approved") {
			return { success: true, alreadyVerified: true };
		}

		// Upsert qualification and approve it
		let qualId: string;
		if (existing) {
			qualId = existing.id;
		} else {
			const qual = await this.upsert(userId, tokenRow.typeId);
			qualId = qual.id;
		}

		await this.approve(qualId, tokenRow.createdBy);
		return { success: true };
	},
};

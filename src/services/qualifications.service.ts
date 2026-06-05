import { and, eq } from "drizzle-orm";
import { db } from "~/db/connection";
import {
  qualificationTypes,
  insertQualificationTypeSchema,
  updateQualificationTypeSchema,
  type QualificationType,
} from "~/db/schemas/qualification-types";
import {
  userQualifications,
  insertUserQualificationSchema,
  type UserQualification,
} from "~/db/schemas/user-qualifications";
import { membershipsService } from "./memberships.service";
import { userTagsService } from "./user-tags.service";
import crypto from "crypto";

export type UserQualificationWithType = UserQualification & {
  type: QualificationType;
};

export const qualificationsService = {
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

  async getPendingApplications(): Promise<UserQualificationWithType[]> {
    const rows = await db.query.userQualifications.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      with: { type: true, user: true },
    });
    return rows as UserQualificationWithType[];
  },

  async getAllApplications(): Promise<UserQualificationWithType[]> {
    const rows = await db.query.userQualifications.findMany({
      orderBy: { createdAt: "desc" },
      with: { type: true, user: true },
    });
    return rows as UserQualificationWithType[];
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
      with: { type: true, user: true },
    });
    return row as UserQualificationWithType | undefined;
  },

  async upsert(
    userId: string,
    typeId: string,
  ): Promise<UserQualification> {
    const [existing] = await db
      .select()
      .from(userQualifications)
      .where(and(eq(userQualifications.userId, userId), eq(userQualifications.typeId, typeId)))
      .limit(1);
    if (existing) return existing;

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
};

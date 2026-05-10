import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "~/db/connection";
import type { Form, InsertForm, UpdateForm } from "~/db/schema";
import { forms, insertFormSchema, updateFormSchema } from "~/db/schema";
import { formValidationService } from "~/services/form-validation.service";
import { buildFormPath } from "~/utils/forms";

export const formsService = {
  buildFormPath(form: Pick<Form, "id" | "slug">): string {
    return buildFormPath(form);
  },

  async getById(id: string): Promise<Form | undefined> {
    return db.query.forms.findFirst({ where: { id } });
  },

  async getBySystemKey(systemKey: string): Promise<Form | undefined> {
    return db.query.forms.findFirst({ where: { systemKey } });
  },

  async getByIdAndScope(
    id: string,
    scopeType: "global" | "group",
    scopeId: string | null,
  ): Promise<Form | undefined> {
    return db.query.forms.findFirst({
      where:
        scopeType === "group"
          ? { id, scopeType: "group", scopeId: scopeId || "" }
          : { id, scopeType: "global", scopeId: { isNull: true } },
    });
  },

  async getByRouteSlug(routeSlug: string): Promise<Form | undefined> {
    const id = routeSlug.substring(0, 36);
    if (!id || id.length !== 36) {
      return undefined;
    }

    return this.getById(id);
  },

  async listByScope(
    scopeType: "global" | "group",
    scopeId: string | null,
  ): Promise<Form[]> {
    return db.query.forms.findMany({
      where:
        scopeType === "group"
          ? { scopeType: "group", scopeId: scopeId || "" }
          : { scopeType: "global", scopeId: { isNull: true } },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(data: InsertForm): Promise<Form> {
    const parsed = insertFormSchema.parse(data);
    const schemaJson = formValidationService.validateSurveyJson(parsed.schemaJson);

    if (parsed.isSystemForm && parsed.systemKey) {
      const existing = await this.getBySystemKey(parsed.systemKey);
      if (existing) {
        throw new Error("A form with this system key already exists.");
      }
    }

    const [created] = await db
      .insert(forms)
      .values({
        ...parsed,
        schemaJson,
      } as any)
      .returning();

    return created;
  },

  async update(id: string, data: UpdateForm): Promise<Form | undefined> {
    const parsed = updateFormSchema.parse(data);

    const nextSchemaJson = parsed.schemaJson
      ? formValidationService.validateSurveyJson(parsed.schemaJson)
      : undefined;

    if (parsed.isSystemForm && parsed.systemKey) {
      const existing = await this.getBySystemKey(parsed.systemKey);
      if (existing && existing.id !== id) {
        throw new Error("A form with this system key already exists.");
      }
    }

    const [updated] = await db
      .update(forms)
      .set({
        ...parsed,
        ...(nextSchemaJson ? { schemaJson: nextSchemaJson } : {}),
        updatedAt: new Date().toISOString(),
      } as any)
      .where(eq(forms.id, id))
      .returning();

    return updated;
  },
};

import { Model } from "survey-core";
import { z } from "zod";

const choiceSchema = z.object({
  value: z.string().min(1),
  text: z.string().min(1),
});

const simpleFieldSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, "ID must be lowercase alphanumeric with underscores and start with a letter."),
  title: z.string().min(1),
  type: z.enum(["text", "textarea", "radiogroup", "select"]),
  required: z.boolean().default(false),
  description: z.string().optional(),
  choices: z.array(choiceSchema).optional(),
});

const baseSurveySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  pages: z
    .array(
      z
        .object({
          name: z.string().optional(),
          title: z.string().optional(),
          elements: z.array(z.unknown()),
        })
        .passthrough(),
    )
    .min(1),
});

const resultPayloadSchema = z.record(z.string(), z.unknown());

export type SimpleField = z.infer<typeof simpleFieldSchema>;

const toFieldId = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) {
    return "field_1";
  }

  if (/^[0-9]/.test(normalized)) {
    return `field_${normalized}`;
  }

  return normalized;
};

export const formValidationService = {
  parseSimpleFields(raw: unknown): SimpleField[] {
    const arr = z.array(simpleFieldSchema).min(1).parse(raw);

    for (const field of arr) {
      if ((field.type === "radiogroup" || field.type === "select") && (!field.choices || field.choices.length === 0)) {
        throw new Error(`Field '${field.name}' requires at least one option.`);
      }
    }

    const names = new Set<string>();
    for (const field of arr) {
      if (names.has(field.name)) {
        throw new Error(`Field name '${field.name}' is duplicated.`);
      }
      names.add(field.name);
    }

    return arr;
  },

  buildSurveyJsonFromSimpleFields(fields: SimpleField[], title?: string, description?: string): Record<string, any> {
    const elements = fields.map((field) => {
      const type = field.type === "select" ? "dropdown" : field.type === "textarea" ? "comment" : field.type;

      return {
        type,
        name: field.name,
        title: field.title,
        isRequired: field.required,
        description: field.description,
        ...(field.choices ? { choices: field.choices } : {}),
      };
    });

    return {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      pages: [
        {
          name: "page1",
          elements,
        },
      ],
    };
  },

  validateSurveyJson(raw: unknown): Record<string, any> {
    const parsed = baseSurveySchema.passthrough().parse(raw);

    const model = new Model(parsed as any);
    if (!model.pages || model.pages.length === 0) {
      throw new Error("Survey must have at least one page.");
    }

    const questions = model.getAllQuestions();
    if (!questions || questions.length === 0) {
      throw new Error("Survey must have at least one question.");
    }

    return parsed as Record<string, any>;
  },

  validateResultPayload(raw: unknown): Record<string, any> {
    return resultPayloadSchema.parse(raw);
  },

  extractSimpleFieldsFromSurvey(raw: unknown): SimpleField[] {
    const survey = this.validateSurveyJson(raw);
    const firstPage = Array.isArray(survey.pages) ? survey.pages[0] : undefined;
    const elements = Array.isArray(firstPage?.elements) ? firstPage.elements : [];

    const simpleFields = elements
      .map((element: unknown) => {
        const question = element as Record<string, any>;
        const type = String(question.type || "");

        const mappedType =
          type === "dropdown"
            ? "select"
            : type === "comment"
              ? "textarea"
              : type;

        if (!["text", "textarea", "radiogroup", "select"].includes(mappedType)) {
          return null;
        }

        const choices = Array.isArray(question.choices)
          ? question.choices
              .map((choice: any) => {
                const value = String(choice?.value ?? "").trim();
                const text = String(choice?.text ?? choice?.value ?? "").trim();
                if (!value || !text) {
                  return null;
                }
                return { value, text };
              })
              .filter(Boolean)
          : undefined;

        return {
          name: toFieldId(String(question.name || "")),
          title: String(question.title || ""),
          type: mappedType as SimpleField["type"],
          required: Boolean(question.isRequired),
          description: String(question.description || "") || undefined,
          choices,
        };
      })
      .filter(Boolean);

    if (simpleFields.length === 0) {
      return [];
    }

    return z.array(simpleFieldSchema).parse(simpleFields);
  },
};

import { component$, useSignal } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { SimpleFormBuilder } from "~/components/forms/SimpleFormBuilder";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";
import { formValidationService } from "~/services/form-validation.service";
import { formsService } from "~/services/forms.service";
import { buildFormPath } from "~/utils/forms";
import { buildFormsAdminBasePath, resolveFormsAdminScope } from "../../_utils";

export const useForm = routeLoader$(async (event) => {
  const scope = await resolveFormsAdminScope(event);
  const form = await formsService.getByIdAndScope(event.params.id, scope.scopeType, scope.scopeId);
  if (!form) {
    throw event.redirect(302, buildFormsAdminBasePath(event.params.group_slug));
  }

  return {
    form,
    basePath: buildFormsAdminBasePath(event.params.group_slug),
    simpleFields: formValidationService.extractSimpleFieldsFromSurvey(form.schemaJson),
  };
});

export const useUpdateForm = routeAction$(
  async (data, event) => {
    const scope = await resolveFormsAdminScope(event);
    const existing = await formsService.getByIdAndScope(event.params.id, scope.scopeType, scope.scopeId);
    if (!existing) {
      return { success: false, error: "Form not found" };
    }
    try {
      let schemaJson: Record<string, any>;
      if (data.builderMode === "simple") {
        const rawFields = JSON.parse(data.simpleFieldsJson || "[]");
        const fields = formValidationService.parseSimpleFields(rawFields);
        schemaJson = formValidationService.buildSurveyJsonFromSimpleFields(
          fields,
          data.title,
          data.description || undefined,
        );
      } else {
        schemaJson = formValidationService.validateSurveyJson(JSON.parse(data.schemaJson));
      }

      await formsService.update(existing.id, {
        title: data.title,
        slug: data.slug,
        description: data.description || null,
        schemaJson,
        visibility: data.visibility,
        isSystemForm: data.isSystemForm,
        systemKey: data.isSystemForm ? data.systemKey || null : null,
      });

      throw event.redirect(303, buildFormsAdminBasePath(event.params.group_slug));
    } catch (error: any) {
      if (error?.status === 303) {
        throw error;
      }

      return {
        success: false,
        error: error?.message || "Failed to update form",
      };
    }
  },
  zod$({
    title: z.string().min(1, "Title is required"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, '_' and '-'."),
    description: z.string().optional(),
    visibility: z.enum(["private", "public"]).default("private"),
    builderMode: z.enum(["simple", "json"]).default("simple"),
    simpleFieldsJson: z.string().optional(),
    schemaJson: z.string().default('{"pages":[]}'),
    isSystemForm: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    systemKey: z.string().optional(),
  }),
);

export default component$(() => {
  const loader = useForm();
  const action = useUpdateForm();

  const defaultMode: "simple" | "json" = loader.value.simpleFields.length > 0 ? "simple" : "json";
  const builderMode = useSignal(((action.formData?.get("builderMode") as string) || defaultMode) as "simple" | "json");

  return (
    <div class="max-w-4xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Edit Form</h1>

      <div class="mb-6">
        <Button href={`${loader.value.basePath}/${loader.value.form.id}/responses`} variant="secondary">
          View Responses
        </Button>
      </div>

      {(action.value as { error?: string } | undefined)?.error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {(action.value as { error?: string }).error}
        </div>
      )}

      {action.value?.failed && action.value?.formErrors?.[0] && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {action.value.formErrors[0]}
        </div>
      )}

      <Card>
        <Form action={action} class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              name="title"
              label="Title"
              required
              value={action.formData?.get("title") || loader.value.form.title}
              error={action.value?.fieldErrors?.title?.[0]}
            />
            <Input
              name="slug"
              label="Slug"
              required
              value={action.formData?.get("slug") || loader.value.form.slug}
              error={action.value?.fieldErrors?.slug?.[0]}
              placeholder="signup-survey"
            />
          </div>

          <TextArea
            name="description"
            label="Description"
            value={(action.formData?.get("description") as string) || loader.value.form.description || ""}
            rows={3}
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              name="visibility"
              label="Visibility"
              value={(action.formData?.get("visibility") as string) || loader.value.form.visibility}
            >
              <option value="private">Private (login required)</option>
              <option value="public">Public</option>
            </Select>

            <Select
              name="builderMode"
              label="Builder Mode"
              value={builderMode.value}
              onChange$={(event) => {
                builderMode.value = (event.target as HTMLSelectElement).value as "simple" | "json";
              }}
            >
              <option value="simple">Simple Builder</option>
              <option value="json">Paste SurveyJS JSON</option>
            </Select>
          </div>

          {builderMode.value === "simple" ? (
            <div class="forms-builder-card">
              <p class="text-sm text-gray-600 mb-2">
                Build fields directly. IDs are auto-generated from question titles.
              </p>
              <SimpleFormBuilder
                inputName="simpleFieldsJson"
                initialValue={
                  (action.formData?.get("simpleFieldsJson") as string) || JSON.stringify(loader.value.simpleFields)
                }
              />
            </div>
          ) : (
            <TextArea
              name="schemaJson"
              label="SurveyJS JSON"
              value={
                (action.formData?.get("schemaJson") as string) || JSON.stringify(loader.value.form.schemaJson, null, 2)
              }
              rows={14}
            />
          )}

          <div class="forms-inline-checkbox">
            <input
              id="isSystemForm"
              type="checkbox"
              name="isSystemForm"
              checked={
                action.formData?.get("isSystemForm") === "on" ||
                (action.formData?.get("isSystemForm") === null && loader.value.form.isSystemForm)
              }
            />
            <label for="isSystemForm" class="forms-field-label mb-0">
              Mark as system form
            </label>
          </div>

          <Input
            name="systemKey"
            label="System Key (only for system forms)"
            value={(action.formData?.get("systemKey") as string) || loader.value.form.systemKey || ""}
            placeholder="onboarding"
          />

          <p class="text-sm text-gray-500">Public URL: {buildFormPath(loader.value.form)}</p>

          <div class="flex gap-4">
            <Button type="submit" disabled={action.isRunning}>
              {action.isRunning ? "Updating..." : "Update Form"}
            </Button>
            <Button href={loader.value.basePath} variant="secondary">
              Cancel
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
});

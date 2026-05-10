import { component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/db/schema";
import { SurveyRuntime } from "~/components/forms/SurveyRuntime";

export const definition: BlockDefinition = {
  name: "Survey Form",
  componentType: "SurveyFormBlock",
  category: "dynamic",
  icon: "📝",
  configSchema: [
    {
      name: "formId",
      label: "Form ID",
      type: "text",
      required: true,
      placeholder: "UUID of the form",
    },
    {
      name: "showTitle",
      label: "Show Form Title",
      type: "boolean",
      defaultValue: true,
    },
  ],
  defaultData: {
    formId: "",
    showTitle: true,
  },
};

type SurveyFormBlockProps = {
  formId: string;
  showTitle?: boolean;
};

export default component$<SurveyFormBlockProps>(({ formId, showTitle = true }) => {
  const formData = useSignal<{
    id: string;
    title: string;
    description: string | null;
    schemaJson: Record<string, any>;
    requireAltcha: boolean;
  } | null>(null);
  const error = useSignal<string>("");

  useVisibleTask$(async ({ track }) => {
    track(() => formId);
    if (!formId) {
      error.value = "Form ID is required.";
      formData.value = null;
      return;
    }

    const response = await fetch(`/api/forms/${formId}`, {
      credentials: "same-origin",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: "Failed to load form." }))) as {
        error?: string;
      };
      error.value = payload.error || "Failed to load form.";
      formData.value = null;
      return;
    }

    const payload = (await response.json()) as {
      data: {
        id: string;
        title: string;
        description: string | null;
        schemaJson: Record<string, any>;
        requireAltcha: boolean;
      };
    };

    formData.value = payload.data;
    error.value = "";
  });

  if (error.value) {
    return <div class="forms-alert forms-alert-error">{error.value}</div>;
  }

  if (!formData.value) {
    return <div class="forms-alert forms-alert-info">Loading form...</div>;
  }

  return (
    <section class="forms-embed-block">
      {showTitle && <h3 class="forms-embed-title">{formData.value.title}</h3>}
      {formData.value.description && <p class="forms-embed-description">{formData.value.description}</p>}
      <SurveyRuntime
        surveyJson={formData.value.schemaJson}
        submitUrl={`/api/forms/${formData.value.id}/submit`}
        requireAltcha={formData.value.requireAltcha}
      />
    </section>
  );
});

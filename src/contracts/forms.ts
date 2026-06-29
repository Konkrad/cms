/**
 * Core → theme data contract for the public form submission route
 * (`/forms/[formSlug]`).
 */
import type { useFormPage } from "~/routes/forms/[formSlug]";

export type FormPageViewData = ReturnType<typeof useFormPage>["value"];

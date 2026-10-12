import { component$ } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { t } from "~/contracts/i18n";
import type {
	RequirementStepData,
	SubmitRequirementAction,
} from "~/contracts/requirements";
import { type FormQuestion, FormRenderer } from "~/core/forms/FormRenderer";
import { GenericFields } from "./GenericFields";
import { LocationFields } from "./LocationFields";
import { ProfileFields } from "./ProfileFields";

export type RequirementStepProps = {
	step: RequirementStepData;
	/** Core's single step action (`useSubmitRequirement`), called in the route or module view. */
	action: SubmitRequirementAction;
	submitLabel?: string;
};

/**
 * One pending user requirement (spec 4.6) as a form posting to core's single step action. The
 * server validates it with the requirement's schema; problems come back per field.
 */
export const RequirementStep = component$<RequirementStepProps>(
	({ step, action, submitLabel = t("theme.requirementStep.continue") }) => {
		const result = action.value as
			| {
					failed?: boolean;
					requirementId?: string;
					message?: string;
					fieldErrors?: Record<string, string>;
			  }
			| undefined;
		const failure =
			result?.failed && result.requirementId === step.id ? result : null;
		const errors = failure?.fieldErrors ?? {};

		return (
			<Card>
				<Form
					action={action}
					class="space-y-5"
					data-testid="requirement-step"
					data-requirement={step.id}
				>
					<input type="hidden" name="requirementId" value={step.id} />
					<div>
						<h2 class="text-xl font-semibold">{step.title}</h2>
						{step.description && (
							<p class="text-text-secondary mt-1">{step.description}</p>
						)}
					</div>

					{failure?.message && <Alert variant="error">{failure.message}</Alert>}

					{step.view === "core.profile" ? (
						<ProfileFields values={step.values} errors={errors} />
					) : step.view === "core.location" ? (
						<LocationFields values={step.values} />
					) : step.view === "core.form" ? (
						<FormRenderer
							questions={(step.data?.questions as FormQuestion[]) ?? []}
							values={step.values}
							errors={errors}
						/>
					) : (
						<GenericFields
							fields={step.fields}
							values={step.values}
							errors={errors}
						/>
					)}

					<Button type="submit" disabled={action.isRunning}>
						{submitLabel}
					</Button>
				</Form>
			</Card>
		);
	},
);

/** The first of several pending steps, with how many are left (the next shows after saving). */
export const RequirementSteps = component$<{
	steps: RequirementStepData[];
	action: SubmitRequirementAction;
}>(({ steps, action }) => {
	const [current] = steps;
	if (!current) return null;
	return (
		<div class="space-y-3" data-testid="requirement-steps">
			{steps.length > 1 && (
				<p class="text-sm text-text-secondary">
					{t("theme.requirementStep.stepsLeft", { count: steps.length })}
				</p>
			)}
			<RequirementStep key={current.id} step={current} action={action} />
		</div>
	);
});

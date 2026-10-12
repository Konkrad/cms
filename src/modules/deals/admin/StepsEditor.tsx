import { $, component$, type QRL, useSignal } from "@qwik.dev/core";
import { Button, Input, Select, TextArea, t } from "~/core/ui";
import type { DealStep } from "../schema";

interface StepsEditorProps {
	initialSteps?: DealStep[];
	name?: string;
}

const emptyStep = (): DealStep => ({
	type: "text",
	title: "",
	text: "",
	requiresLogin: false,
});

export const StepsEditor = component$<StepsEditorProps>(
	({ initialSteps = [], name = "steps" }) => {
		const steps = useSignal<DealStep[]>(
			initialSteps.length > 0 ? initialSteps : [],
		);

		const addStep$ = $(() => {
			steps.value = [...steps.value, emptyStep()];
		});

		const removeStep$: QRL<(index: number) => void> = $((index: number) => {
			steps.value = steps.value.filter((_, i) => i !== index);
		});

		const updateStep$: QRL<(index: number, patch: Partial<DealStep>) => void> =
			$((index: number, patch: Partial<DealStep>) => {
				const next = steps.value.map((s, i) =>
					i === index ? { ...s, ...patch } : s,
				);
				steps.value = next;
			});

		return (
			<div class="flex flex-col gap-4">
				<input type="hidden" name={name} value={JSON.stringify(steps.value)} />

				{steps.value.length === 0 && (
					<p class="text-sm text-gray-500">
						{t("deals.admin.stepsEditor.noStepsYetAddA")}
					</p>
				)}

				{steps.value.map((step, index) => (
					<div
						key={index}
						class="border border-border-strong rounded-lg p-4 flex flex-col gap-3 bg-gray-50"
					>
						<div class="flex items-center justify-between">
							<span class="text-sm font-semibold text-gray-700">
								{t("deals.admin.stepsEditor.step", { value: index + 1 })}
							</span>
							<button
								type="button"
								onClick$={() => removeStep$(index)}
								class="text-sm text-red-500 hover:text-red-700"
							>
								{t("deals.admin.stepsEditor.remove")}
							</button>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<Select
								label={t("deals.admin.stepsEditor.type")}
								value={step.type}
								onChange$={(e) =>
									updateStep$(index, {
										type: (e.target as HTMLSelectElement)
											.value as DealStep["type"],
									})
								}
							>
								<option value="text">
									{t("deals.admin.stepsEditor.text")}
								</option>
								<option value="link">
									{t("deals.admin.stepsEditor.link")}
								</option>
								<option value="promo">
									{t("deals.admin.stepsEditor.promoCode")}
								</option>
							</Select>

							<div class="flex items-end pb-1">
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={step.requiresLogin ?? false}
										onChange$={(e) =>
											updateStep$(index, {
												requiresLogin: (e.target as HTMLInputElement).checked,
											})
										}
										class="rounded"
									/>
									<span class="text-sm font-medium text-text">
										{t("deals.admin.stepsEditor.requiresLogin")}
									</span>
								</label>
							</div>
						</div>

						<Input
							label={t("deals.admin.stepsEditor.title")}
							value={step.title}
							onInput$={(e) =>
								updateStep$(index, {
									title: (e.target as HTMLInputElement).value,
								})
							}
							required
						/>

						<TextArea
							label={t("deals.admin.stepsEditor.text")}
							value={step.text}
							rows={2}
							onInput$={(e) =>
								updateStep$(index, {
									text: (e.target as HTMLTextAreaElement).value,
								})
							}
						/>

						{step.type === "link" && (
							<>
								<Input
									label={t("deals.admin.stepsEditor.url")}
									type="url"
									value={step.link ?? ""}
									onInput$={(e) =>
										updateStep$(index, {
											link: (e.target as HTMLInputElement).value,
										})
									}
									placeholder={t("deals.admin.stepsEditor.httpsExampleCom")}
								/>
								<Input
									label={t("deals.admin.stepsEditor.linkText")}
									value={step.linkText ?? ""}
									onInput$={(e) =>
										updateStep$(index, {
											linkText: (e.target as HTMLInputElement).value,
										})
									}
									placeholder={t("deals.admin.stepsEditor.goToTheWebsite")}
								/>
							</>
						)}

						{step.type === "promo" && (
							<Input
								label={t("deals.admin.stepsEditor.promoCode")}
								value={step.promoCode ?? ""}
								onInput$={(e) =>
									updateStep$(index, {
										promoCode: (e.target as HTMLInputElement).value,
									})
								}
								placeholder={t("deals.admin.stepsEditor.discount2026")}
							/>
						)}
					</div>
				))}

				<div>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick$={addStep$}
					>
						{t("deals.admin.stepsEditor.addStep")}
					</Button>
				</div>
			</div>
		);
	},
);

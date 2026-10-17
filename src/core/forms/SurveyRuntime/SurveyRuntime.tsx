import {
	component$,
	type QRL,
	useSignal,
	useVisibleTask$,
} from "@qwik.dev/core";
import { siteLocale, t } from "~/core/i18n";

type SurveyRuntimeProps = {
	surveyJson: Record<string, any>;
	submitUrl: string;
	requireAltcha: boolean;
	initialData?: Record<string, any>;
	/** Called after a successful submission. */
	onComplete$?: QRL<() => void>;
};

export const SurveyRuntime = component$<SurveyRuntimeProps>(
	({ surveyJson, submitUrl, requireAltcha, initialData, onComplete$ }) => {
		const wrapperRef = useSignal<HTMLElement>();
		const containerRef = useSignal<HTMLElement>();
		const state = useSignal<"idle" | "submitting" | "success" | "error">(
			"idle",
		);
		const message = useSignal<string>("");

		// biome-ignore lint/correctness/noQwikUseVisibleTask: browser-only (camera/DOM/storage) initialisation, must run on the client
		useVisibleTask$(async ({ cleanup }) => {
			await import("survey-js-ui");
			await import("altcha");
			const { Model } = await import("survey-core");

			if (!containerRef.value || !wrapperRef.value) {
				return;
			}

			// SurveyJS's own UI strings (buttons, its validation) in the site locale
			if (siteLocale === "de") {
				// @ts-expect-error survey-core ships no typings for its locale modules (side effect only)
				await import("survey-core/i18n/german");
			}
			const survey = new Model(surveyJson as any);
			survey.locale = siteLocale;
			if (initialData) survey.data = initialData;
			survey.render(containerRef.value);

			survey.onComplete.add(async (sender) => {
				if (!wrapperRef.value) {
					return;
				}

				const altchaValue =
					(
						wrapperRef.value.querySelector(
							"input[name='altcha']",
						) as HTMLInputElement | null
					)?.value || "";

				if (requireAltcha && !altchaValue) {
					state.value = "error";
					message.value = t("core.forms.altchaRequired");
					return;
				}

				state.value = "submitting";
				message.value = t("core.forms.submitting");

				const response = await fetch(submitUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					credentials: "same-origin",
					body: JSON.stringify({
						result: sender.data,
						altcha: altchaValue,
					}),
				});

				if (!response.ok) {
					const payload = (await response
						.json()
						.catch(() => ({ error: t("core.forms.submitFailed") }))) as {
						error?: string;
					};
					state.value = "error";
					message.value = payload.error || t("core.forms.submitFailed");
					return;
				}

				state.value = "success";
				message.value = t("core.forms.submitted");

				if (onComplete$) {
					await onComplete$();
				}
			});

			cleanup(() => {
				survey.dispose();
			});
		});

		return (
			<div ref={wrapperRef} class="forms-shell">
				{state.value !== "idle" && (
					<div
						class={`forms-alert ${
							state.value === "success"
								? "forms-alert-success"
								: state.value === "error"
									? "forms-alert-error"
									: "forms-alert-info"
						}`}
					>
						{message.value}
					</div>
				)}

				{requireAltcha && (
					<div class="forms-altcha">
						<altcha-widget
							challenge="/api/altcha/challenge"
							name="altcha"
							auto="off"
						></altcha-widget>
					</div>
				)}

				<div ref={containerRef} class="forms-survey"></div>
			</div>
		);
	},
);

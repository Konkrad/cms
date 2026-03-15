import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

type SurveyRuntimeProps = {
  surveyJson: Record<string, any>;
  submitUrl: string;
  requireAltcha: boolean;
};

export const SurveyRuntime = component$<SurveyRuntimeProps>(
  ({ surveyJson, submitUrl, requireAltcha }) => {
    const wrapperRef = useSignal<HTMLElement>();
    const containerRef = useSignal<HTMLElement>();
    const state = useSignal<"idle" | "submitting" | "success" | "error">("idle");
    const message = useSignal<string>("");

    useVisibleTask$(async ({ cleanup }) => {
      await import("survey-js-ui");
      await import("altcha");
      const { Model } = await import("survey-core");

      if (!containerRef.value || !wrapperRef.value) {
        return;
      }

      const survey = new Model(surveyJson as any);
      survey.render(containerRef.value);

      survey.onComplete.add(async (sender) => {
        if (!wrapperRef.value) {
          return;
        }

        const altchaValue =
          (wrapperRef.value.querySelector("input[name='altcha']") as HTMLInputElement | null)?.value || "";

        if (requireAltcha && !altchaValue) {
          state.value = "error";
          message.value = "ALTCHA verification is required for this public form.";
          return;
        }

        state.value = "submitting";
        message.value = "Submitting...";

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
          const payload = (await response.json().catch(() => ({ error: "Failed to submit form." }))) as {
            error?: string;
          };
          state.value = "error";
          message.value = payload.error || "Failed to submit form.";
          return;
        }

        state.value = "success";
        message.value = "Form submitted successfully.";
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
              challengeurl="/api/altcha/challenge"
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

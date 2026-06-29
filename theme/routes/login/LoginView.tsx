import { $, component$, useSignal } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import type { SendLoginAction, VerifyLoginAction } from "~/contracts/login";

/** Themed view for the magic-link + OTP login flow (`/login`). */
export const LoginView = component$<{
  sendAction: SendLoginAction;
  verifyAction: VerifyLoginAction;
}>(({ sendAction, verifyAction }) => {
  const email = useSignal("");
  const code = useSignal("");
  const step = useSignal<"send" | "verify">("send");
  const error = useSignal("");
  const info = useSignal("");
  const isLoading = useSignal(false);

  const handleSend = $(async () => {
    if (!email.value) {
      error.value = "Please provide an email";
      return;
    }

    isLoading.value = true;
    error.value = "";
    info.value = "";

    try {
      const formData = new FormData();
      formData.set("email", email.value.trim());
      await sendAction.submit(formData);

      if (!sendAction.value?.success) {
        error.value = sendAction.value?.error || "Failed to send login email";
        return;
      }

      info.value =
        "Check your email for the sign-in link and the 6-letter code.";
      step.value = "verify";
    } catch (err: any) {
      error.value = err?.message || "Failed to send login email";
    } finally {
      isLoading.value = false;
    }
  });

  const handleVerify = $(async () => {
    if (!email.value || !code.value) {
      error.value = "Please enter your email and the 6-letter code";
      return;
    }

    isLoading.value = true;
    error.value = "";
    info.value = "";

    try {
      const formData = new FormData();
      formData.set("email", email.value.trim());
      formData.set("code", code.value.trim());
      await verifyAction.submit(formData);

      // If the action performed a server-side redirect, the client will navigate.
      // Otherwise, check the returned value for errors.
      if (verifyAction.value && !verifyAction.value.success) {
        error.value =
          verifyAction.value.error || "Invalid code or verification failed";
        return;
      }
    } catch (err: any) {
      // If a redirect occurred, the code here may never run.
      // Surface any unexpected errors.
      error.value = err?.message || "Verification failed";
    } finally {
      isLoading.value = false;
    }
  });

  return (
    <div class="min-h-screen bg-white flex flex-col justify-center">
      <div class="w-full max-w-md mx-auto px-6 py-12">
        {step.value === "send" ? (
          <>
            <h1 class="text-4xl font-bold text-text-heading mb-1">Sign In</h1>
            <p class="text-text-secondary mb-8">
              New here?{" "}
              <span class="text-text-secondary">
                Just enter your email — we'll create your account automatically.
              </span>
            </p>

            {error.value && (
              <div class="mb-4 p-3 bg-error-bg border border-error-border text-error rounded-lg text-sm">
                {error.value}
              </div>
            )}

            <form preventdefault:submit onSubmit$={handleSend} class="space-y-5">
              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
                value={email.value}
                onInput$={(e) => (email.value = (e.target as HTMLInputElement).value)}
                required
                disabled={isLoading.value}
              />
              <Button
                type="submit"
                variant="accent"
                size="lg"
                disabled={isLoading.value}
                class="w-full"
              >
                {isLoading.value ? "Sending..." : "Send sign-in link & code"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 class="text-4xl font-bold text-text-heading mb-1">Check your email</h1>
            <p class="text-text-secondary mb-8">
              We sent a 6-letter code to <strong>{email.value}</strong>. Enter it below or click the link in the email.
            </p>

            {error.value && (
              <div class="mb-4 p-3 bg-error-bg border border-error-border text-error rounded-lg text-sm">
                {error.value}
              </div>
            )}
            {info.value && (
              <div class="mb-4 p-3 bg-success-bg border border-success-border text-success rounded-lg text-sm">
                {info.value}
              </div>
            )}

            <form preventdefault:submit onSubmit$={handleVerify} class="space-y-5">
              <Input
                label="6-letter code"
                type="text"
                placeholder="XXXXXX"
                value={code.value}
                onInput$={(e) => (code.value = (e.target as HTMLInputElement).value.toUpperCase())}
                maxLength={6}
                required
              />
              <Button
                type="submit"
                variant="accent"
                size="lg"
                disabled={isLoading.value}
                class="w-full"
              >
                {isLoading.value ? "Verifying..." : "Verify code"}
              </Button>
              <button
                type="button"
                class="w-full text-sm text-text-secondary hover:text-text transition-colors"
                onClick$={() => { step.value = "send"; error.value = ""; }}
              >
                ← Use a different email
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
});

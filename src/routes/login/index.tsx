import { $, component$, useSignal } from "@qwik.dev/core";
import { routeLoader$, routeAction$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
// Using email-based auth (magic link + OTP) instead of the old password-based auth
import { getServerSession } from "~/utils/server-auth";
import { emailAuthService } from "~/services/email-auth.service";
import { env } from "~/env";

/**
 * If already authenticated, redirect away from the login page.
 */
export const useCheckAuth = routeLoader$(async (event) => {
  const user = await getServerSession(event);
  if (user) {
    throw event.redirect(302, "/");
  }
  return null;
});

/**
 * Server action: send login email (magic link + OTP)
 */
export const useSendAction = routeAction$(async (data: any) => {
  const email = String(data?.email || "").trim();
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return { success: false, error: "Invalid email" };
  }

  await emailAuthService.sendLoginEmail(email);
  return { success: true };
});

/**
 * Server action: verify OTP (POST from the login page)
 * On success: sets `session` cookie and redirects to / or /profile
 */
export const useVerifyAction = routeAction$(async (data: any, event: any) => {
  const email = String(data?.email || "").trim();
  const code = String(data?.code || "").trim();

  if (!email || !code) {
    return { success: false, error: "Missing email or code" };
  }

  const ip =
    event.request.headers.get("x-forwarded-for") ||
    event.request.headers.get("cf-connecting-ip") ||
    event.request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = event.request.headers.get("user-agent") || undefined;

  const result = await emailAuthService.verifyOtp(email, code, {
    ip,
    userAgent,
  });

  // Set HTTP-only session cookie
  event.cookie.set("session", result.session.token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "Strict",
    path: "/",
    expires: new Date(result.session.expiresAt),
  });

  // Redirect on success (server-side redirect)
  throw event.redirect(302, result.userCreated ? "/profile" : "/");
});

export default component$(() => {
  const email = useSignal("");
  const code = useSignal("");
  const step = useSignal<"send" | "verify">("send");
  const error = useSignal("");
  const info = useSignal("");
  const isLoading = useSignal(false);

  const sendAction = useSendAction();
  const verifyAction = useVerifyAction();

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
    <div class="container mx-auto px-4 py-8 max-w-md">
      <Card>
        <h1 class="text-3xl font-bold mb-6 text-center">Login</h1>

        {error.value && (
          <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error.value}
          </div>
        )}

        {info.value && (
          <div class="mb-4 p-3 bg-green-50 border border-green-400 text-green-700 rounded">
            {info.value}
          </div>
        )}

        {step.value === "send" ? (
          <form preventdefault:submit onSubmit$={handleSend} class="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email.value}
              onInput$={(e) =>
                (email.value = (e.target as HTMLInputElement).value)
              }
              required
              disabled={isLoading.value}
            />

            <div class="flex gap-4">
              <Button
                type="submit"
                variant="primary"
                disabled={isLoading.value}
                class="flex-1"
              >
                {isLoading.value ? "Sending..." : "Send sign-in link & code"}
              </Button>
            </div>
          </form>
        ) : (
          <form
            preventdefault:submit
            onSubmit$={handleVerify}
            class="space-y-4"
          >
            <Input
              label="Email"
              type="email"
              value={email.value}
              onInput$={(e) =>
                (email.value = (e.target as HTMLInputElement).value)
              }
              required
              disabled
            />

            <Input
              label="6-letter code"
              type="text"
              value={code.value}
              onInput$={(e) =>
                (code.value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase())
              }
              maxLength={6}
              required
            />

            <div class="flex gap-4">
              <Button
                type="submit"
                variant="primary"
                disabled={isLoading.value}
                class="flex-1"
              >
                {isLoading.value ? "Verifying..." : "Verify code"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
});

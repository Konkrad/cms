import { $, component$, useSignal } from "@qwik.dev/core";
import { routeLoader$, routeAction$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
// Using email-based auth (magic link + OTP) instead of the old password-based auth
import { getServerSession } from "~/utils/server-auth";
import { emailAuthService } from "~/services/email-auth.service";
import { RateLimiter } from "~/utils/rate-limit";
import { env } from "~/env";

/**
 * Shared, process-lifetime limiter throttling how often login emails can be
 * requested — per email address and per client IP — to prevent inbox flooding
 * and outbound-mail abuse.
 */
const loginLimiter = new RateLimiter();

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
export const useSendAction = routeAction$(async (data: any, event: any) => {
  const email = String(data?.email || "")
    .trim()
    .toLowerCase();
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return { success: false, error: "Invalid email" };
  }

  const ip =
    event.request.headers.get("x-forwarded-for") ||
    event.request.headers.get("cf-connecting-ip") ||
    event.request.headers.get("x-real-ip") ||
    "unknown";

  const emailCheck = loginLimiter.check(`email:${email}`, {
    limit: env.LOGIN_EMAIL_MAX_PER_WINDOW,
    windowMs: env.LOGIN_EMAIL_WINDOW_MINUTES * 60_000,
  });
  const ipCheck = loginLimiter.check(`ip:${ip}`, {
    limit: env.LOGIN_IP_MAX_PER_WINDOW,
    windowMs: env.LOGIN_IP_WINDOW_MINUTES * 60_000,
  });

  // Opportunistically drop aged-out keys so the in-memory map stays bounded.
  loginLimiter.prune(
    Math.max(env.LOGIN_EMAIL_WINDOW_MINUTES, env.LOGIN_IP_WINDOW_MINUTES) *
      60_000,
  );

  if (!emailCheck.allowed || !ipCheck.allowed) {
    // Generic message: don't reveal which limit tripped or whether the
    // account exists, preserving the flow's no-enumeration property.
    return {
      success: false,
      error: "Too many requests. Please try again later.",
    };
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
  throw event.redirect(302, "/");
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

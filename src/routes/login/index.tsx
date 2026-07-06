import { component$ } from "@qwik.dev/core";
import { routeLoader$, routeAction$ } from "@qwik.dev/router";
// Using email-based auth (magic link + OTP) instead of the old password-based auth
import { getServerSession } from "~/utils/server-auth";
import { emailAuthService } from "~/services/email-auth.service";
import { RateLimiter } from "~/utils/rate-limit";
import { env } from "~/env";
import { useThemeComponent$ } from "~/utils/theme-loader";
import type { FC } from "react";

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
  const sendAction = useSendAction();
  const verifyAction = useVerifyAction();
  const LoginView = useThemeComponent$<
    FC<{
      sendAction: any;
      verifyAction: any;
    }>
  >(() => import("~theme/routes/login/LoginView"));
  return (
    LoginView.value && (
      <LoginView.value sendAction={sendAction} verifyAction={verifyAction} />
    )
  );
});

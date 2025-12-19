/* Relaxed handler typing: allow handlers to return Response | void */
import { emailAuthService } from "~/services/email-auth.service";
import { env } from "~/env";

export const onGet = async (event: any): Promise<Response | void> => {
  try {
    const url = new URL(event.request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing token" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const ip =
      event.request.headers.get("x-forwarded-for") ||
      event.request.headers.get("cf-connecting-ip") ||
      event.request.headers.get("x-real-ip") ||
      undefined;
    const userAgent = event.request.headers.get("user-agent") || undefined;

    const result = await emailAuthService.verifyMagic(token, { ip, userAgent });

    // Set session cookie
    event.cookie.set("session", result.session.token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "Strict",
      path: "/",
      expires: new Date(result.session.expiresAt),
    });

    // If the user hasn't completed their profile yet, redirect to the signup details page.
    // Otherwise redirect to the profile page.
    if (result.userCreated) {
      throw event.redirect(302, "/profile");
    } else {
      throw event.redirect(302, "/signup/details");
    }
  } catch (err: any) {
    console.error("[api/auth/verify:get] error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Invalid or expired token",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const onPost = async (event: any): Promise<Response | void> => {
  try {
    const body = await event.request.json();
    const email = String(body?.email || "").trim();
    const code = String(body?.code || "").trim();

    if (!email || !code) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing email or code" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
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

    // Set session cookie
    event.cookie.set("session", result.session.token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "Strict",
      path: "/",
      expires: new Date(result.session.expiresAt),
    });

    const redirectTo = result.userCreated ? "/profile" : "/signup/details";
    return new Response(
      JSON.stringify({ success: true, redirect: redirectTo }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[api/auth/verify:post] error:", err);
    // Provide a 400 for verification failures, 500 for unexpected issues
    const status =
      err?.message &&
      /expired|invalid|too many attempts|already used/i.test(err.message)
        ? 400
        : 500;
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Verification failed",
      }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

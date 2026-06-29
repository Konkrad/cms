import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { emailAuthService } from "~/services/email-auth.service";
import { env } from "~/env";
import { AuthVerifyView } from "~theme/routes/auth/AuthVerifyView";

export const useVerify = routeLoader$(async (event: any) => {
	const url = new URL(event.request.url);
	const token = url.searchParams.get("token");
	if (!token) {
		return { success: false, error: "Missing token" };
	}

	const ip =
		event.request.headers.get("x-forwarded-for") ||
		event.request.headers.get("cf-connecting-ip") ||
		event.request.headers.get("x-real-ip") ||
		undefined;
	const userAgent = event.request.headers.get("user-agent") || undefined;

	let result: Awaited<ReturnType<typeof emailAuthService.verifyMagic>>;
	try {
		result = await emailAuthService.verifyMagic(token, { ip, userAgent });
	} catch (err: any) {
		console.error("[auth/verify] error:", err);
		return { success: false, error: err?.message || "Invalid or expired token" };
	}

	// Set session cookie
	event.cookie.set("session", result.session.token, {
		httpOnly: true,
		secure: env.isProduction,
		sameSite: "Strict",
		path: "/",
		expires: new Date(result.session.expiresAt),
	});

	throw event.redirect(302, "/");
});

export default component$(() => {
	const res = useVerify();
	return <AuthVerifyView result={res.value} />;
});

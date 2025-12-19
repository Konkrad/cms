import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { emailAuthService } from "~/services/email-auth.service";
import { env } from "~/env";

export const useVerify = routeLoader$(async (event: any) => {
	try {
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

		const result = await emailAuthService.verifyMagic(token, { ip, userAgent });

		// Set session cookie
		event.cookie.set("session", result.session.token, {
			httpOnly: true,
			secure: env.isProduction,
			sameSite: "Strict",
			path: "/",
			expires: new Date(result.session.expiresAt),
		});

		// Redirect to profile for new users, otherwise to homepage
		if (result.userCreated) {
			throw event.redirect(302, "/profile");
		} else {
			throw event.redirect(302, "/");
		}
	} catch (err: any) {
		console.error("[auth/verify] error:", err);
		return { success: false, error: err?.message || "Invalid or expired token" };
	}
});

export default component$(() => {
	const res = useVerify();

	// While the server is processing we'll briefly render a message (usually the loader redirects)
	if (!res.value) {
		return <div class="container mx-auto px-4 py-8">Verifying...</div>;
	}

	// On error, show a friendly message and a link back to login
	if (!res.value.success) {
		return (
			<div class="container mx-auto px-4 py-8 max-w-md">
				<h1 class="text-2xl font-bold mb-2">Verification failed</h1>
				<p class="mb-4 text-gray-700">{res.value.error}</p>
				<a href="/login" class="text-blue-600 hover:text-blue-800">
					Return to login
				</a>
			</div>
		);
	}

	return null;
});

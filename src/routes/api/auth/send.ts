import type { RequestHandler } from "@builder.io/qwik-city";
import { emailAuthService } from "~/services/email-auth.service";

export const onPost: RequestHandler = async (event) => {
	try {
		const body = await event.request.json();
		const email = String(body?.email || "").trim();

		// Basic validation
		if (!email || !/\S+@\S+\.\S+/.test(email)) {
			return new Response(
				JSON.stringify({ success: false, error: "Invalid email" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		await emailAuthService.sendLoginEmail(email);

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (err: any) {
		console.error("[api/auth/send] error:", err);
		return new Response(
			JSON.stringify({
				success: false,
				error: err?.message || "Internal server error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};

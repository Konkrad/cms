import { $, component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, useNavigate } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { getServerSession } from "~/utils/server-auth";

export const useCheckAuth = routeLoader$(async (event) => {
	const user = await getServerSession(event);
	if (user) {
		throw event.redirect(302, "/");
	}
	return null;
});

export default component$(() => {
	const nav = useNavigate();
	const email = useSignal("");
	const code = useSignal("");
	const step = useSignal<"send" | "verify">("send");
	const error = useSignal("");
	const info = useSignal("");
	const isLoading = useSignal(false);

	const handleSend = $(async () => {
		if (!email.value) {
			error.value = "Please enter your email";
			return;
		}

		isLoading.value = true;
		error.value = "";
		info.value = "";

		try {
			const res = await fetch("/api/auth/send", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.value.trim() }),
			});

			const data = await res.json();
			if (!res.ok || !data?.success) {
				error.value = data?.error || "Failed to send sign-up email";
				return;
			}

			info.value =
				"Check your email for the sign-in link and the 6-letter code.";
			step.value = "verify";
		} catch (err: any) {
			console.error("[signup] send error", err);
			error.value = err?.message || "Failed to send sign-up email";
		} finally {
			isLoading.value = false;
		}
	});

	const handleVerify = $(async () => {
		if (!email.value || !code.value) {
			error.value = "Please enter email and the 6-letter code";
			return;
		}

		isLoading.value = true;
		error.value = "";
		info.value = "";

		try {
			const res = await fetch("/api/auth/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: email.value.trim(),
					code: code.value.trim(),
				}),
			});

			const data = await res.json();
			if (!res.ok || !data?.success) {
				error.value = data?.error || "Verification failed";
				return;
			}

			// If server indicates a redirect, follow it (server sets cookie)
			if (data?.redirect) {
				window.location.href = data.redirect;
			} else {
				await nav("/");
			}
		} catch (err: any) {
			console.error("[signup] verify error", err);
			error.value = err?.message || "Verification failed";
		} finally {
			isLoading.value = false;
		}
	});

	return (
		<div class="container mx-auto px-4 py-8 max-w-md">
			<Card>
				<h1 class="text-3xl font-bold mb-6 text-center">Sign Up</h1>

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
								{isLoading.value ? "Sending..." : "Send sign-up email"}
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
							disabled={isLoading.value}
						/>

						<div class="flex gap-4">
							<Button
								type="submit"
								variant="primary"
								disabled={isLoading.value}
								class="flex-1"
							>
								{isLoading.value ? "Verifying..." : "Verify Code"}
							</Button>
						</div>

						<div class="mt-3 text-sm text-gray-600">
							<p>
								Didn't receive an email?{" "}
								<a href="#" onClick$={handleSend} class="text-blue-600">
									Resend
								</a>
							</p>
						</div>
					</form>
				)}

				<div class="mt-6 text-center">
					<p class="text-gray-600">
						Already have an account?{" "}
						<a
							href="/login"
							class="text-blue-600 hover:text-blue-800 font-medium"
						>
							Login
						</a>
					</p>
				</div>
			</Card>
		</div>
	);
});

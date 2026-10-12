import { $, component$, useSignal } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { t } from "~/contracts/i18n";
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
			error.value = t("theme.login.pleaseProvideAnEmail");
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
				error.value =
					sendAction.value?.error || t("theme.login.failedToSendLoginEmail");
				return;
			}

			info.value = t("theme.login.checkYourEmailForThe");
			step.value = "verify";
		} catch (err: any) {
			error.value = err?.message || t("theme.login.failedToSendLoginEmail");
		} finally {
			isLoading.value = false;
		}
	});

	const handleVerify = $(async () => {
		if (!email.value || !code.value) {
			error.value = t("theme.login.pleaseEnterYourEmailAnd");
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
					verifyAction.value.error ||
					t("theme.login.invalidCodeOrVerificationFailed");
				return;
			}
		} catch (err: any) {
			// If a redirect occurred, the code here may never run.
			// Surface any unexpected errors.
			error.value = err?.message || t("theme.login.verificationFailed");
		} finally {
			isLoading.value = false;
		}
	});

	return (
		<div class="min-h-screen bg-white flex flex-col justify-center">
			<div class="w-full max-w-md mx-auto px-6 py-12">
				{step.value === "send" ? (
					<>
						<h1 class="text-4xl font-bold text-text-heading mb-1">
							{t("theme.login.signIn")}
						</h1>
						<p class="text-text-secondary mb-8">
							{t("theme.login.newHere")}{" "}
							<span class="text-text-secondary">
								{t("theme.login.justEnterYourEmailWe")}
							</span>
						</p>

						{error.value && (
							<div class="mb-4 p-3 bg-error-bg border border-error-border text-error rounded-lg text-sm">
								{error.value}
							</div>
						)}

						<form
							preventdefault:submit
							onSubmit$={handleSend}
							class="space-y-5"
						>
							<Input
								label={t("theme.login.email")}
								type="email"
								placeholder={t("theme.login.yourEmailCom")}
								value={email.value}
								onInput$={(e) => {
									email.value = (e.target as HTMLInputElement).value;
								}}
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
								{isLoading.value
									? t("theme.login.sending")
									: t("theme.login.sendSignInLinkCode")}
							</Button>
						</form>
					</>
				) : (
					<>
						<h1 class="text-4xl font-bold text-text-heading mb-1">
							{t("theme.login.checkYourEmail")}
						</h1>
						<p class="text-text-secondary mb-8">
							{t("theme.login.weSentA6Letter")} <strong>{email.value}</strong>
							{t("theme.login.enterItBelowOrClick")}
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

						<form
							preventdefault:submit
							onSubmit$={handleVerify}
							class="space-y-5"
						>
							<Input
								label={t("theme.login.n6LetterCode")}
								type="text"
								placeholder={t("theme.login.xxxxxx")}
								value={code.value}
								onInput$={(e) => {
									code.value = (
										e.target as HTMLInputElement
									).value.toUpperCase();
								}}
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
								{isLoading.value
									? t("theme.login.verifying")
									: t("theme.login.verifyCode")}
							</Button>
							<button
								type="button"
								class="w-full text-sm text-text-secondary hover:text-text transition-colors"
								onClick$={() => {
									step.value = "send";
									error.value = "";
								}}
							>
								{t("theme.login.useADifferentEmail")}
							</button>
						</form>
					</>
				)}
			</div>
		</div>
	);
});

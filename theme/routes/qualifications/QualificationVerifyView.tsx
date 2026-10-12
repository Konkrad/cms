import { component$ } from "@qwik.dev/core";
import { t } from "~/contracts/i18n";
import type { QualificationVerifyViewData } from "~/contracts/qualifications";

/** Themed view for the qualification verify route (`/qualifications/verify/[token]`). */
export const QualificationVerifyView = component$<{
	result: QualificationVerifyViewData;
}>(({ result }) => {
	if (!result.success) {
		return (
			<div class="min-h-screen flex items-center justify-center px-4">
				<div class="max-w-md w-full text-center">
					<div class="w-16 h-16 bg-error-bg rounded-full flex items-center justify-center mx-auto mb-4">
						<svg
							aria-hidden="true"
							class="w-8 h-8 text-error"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</div>
					<h1 class="text-2xl font-bold text-text-heading mb-2">
						{t("theme.qualificationVerify.verificationFailed")}
					</h1>
					<p class="text-text-secondary mb-6">{result.error}</p>
					<a href="/profile" class="text-primary hover:underline text-sm">
						{t("theme.qualificationVerify.goToMyProfile")}
					</a>
				</div>
			</div>
		);
	}

	if (result.alreadyVerified) {
		return (
			<div class="min-h-screen flex items-center justify-center px-4">
				<div class="max-w-md w-full text-center">
					<div class="w-16 h-16 bg-info-bg rounded-full flex items-center justify-center mx-auto mb-4">
						<svg
							aria-hidden="true"
							class="w-8 h-8 text-primary"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width={2}
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<h1 class="text-2xl font-bold text-text-heading mb-2">
						{t("theme.qualificationVerify.alreadyVerified")}
					</h1>
					<p class="text-text-secondary mb-6">
						{t("theme.qualificationVerify.youAlreadyHaveThisQualification")}
					</p>
					<a
						href="/profile"
						class="inline-block bg-primary text-white px-5 py-2 rounded-md font-medium hover:bg-primary"
					>
						{t("theme.qualificationVerify.viewMyProfile")}
					</a>
				</div>
			</div>
		);
	}

	return (
		<div class="min-h-screen flex items-center justify-center px-4">
			<div class="max-w-md w-full text-center">
				<div class="w-16 h-16 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-4">
					<svg
						aria-hidden="true"
						class="w-8 h-8 text-success"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width={2}
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h1 class="text-2xl font-bold text-text-heading mb-2">
					{t("theme.qualificationVerify.qualificationVerified")}
				</h1>
				<p class="text-text-secondary mb-6">
					{t("theme.qualificationVerify.yourQualificationHasBeenVerified")}
				</p>
				<a
					href="/profile"
					class="inline-block bg-success text-white px-5 py-2 rounded-md font-medium hover:bg-success"
				>
					{t("theme.qualificationVerify.viewMyProfile")}
				</a>
			</div>
		</div>
	);
});

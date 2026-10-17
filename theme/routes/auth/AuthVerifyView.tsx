import { component$ } from "@qwik.dev/core";
import type { AuthVerifyViewData } from "~/contracts/auth";
import { t } from "~/contracts/i18n";

/**
 * Themed view for the magic-link verification route (`/auth/verify`). The
 * loader normally redirects on success, so this only ever renders the
 * loading/error states.
 */
export const AuthVerifyView = component$<{ result: AuthVerifyViewData }>(
	({ result }) => {
		if (!result) {
			return (
				<div class="container mx-auto px-4 py-8">
					{t("theme.authVerify.verifying")}
				</div>
			);
		}

		if (!result.success) {
			return (
				<div class="container mx-auto px-4 py-8 max-w-md">
					<h1 class="text-2xl font-bold mb-2">
						{t("theme.authVerify.verificationFailed")}
					</h1>
					<p class="mb-4 text-text-secondary">{result.error}</p>
					<a href="/login" class="text-primary hover:text-primary">
						{t("theme.authVerify.returnToLogin")}
					</a>
				</div>
			);
		}

		return null;
	},
);

import { component$ } from "@qwik.dev/core";
import { t } from "~/contracts/i18n";
import type { PublicProfileViewData } from "~/contracts/users";
import { UserProfile } from "~theme/routes/profile/UserProfile/UserProfile";

/** Themed view for another user's public profile (`/users/[userId]`). */
export const PublicProfileView = component$<{ data: PublicProfileViewData }>(
	({ data }) => {
		if (!data) {
			return (
				<div class="container mx-auto px-4 py-16 max-w-4xl text-center">
					<h1 class="text-2xl font-bold text-text">
						{t("theme.publicProfile.profileNotFound")}
					</h1>
					<p class="text-text-muted mt-2">
						{t("theme.publicProfile.thisProfileDoesNotExist")}
					</p>
				</div>
			);
		}

		return <UserProfile {...data} />;
	},
);

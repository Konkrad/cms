import { component$ } from "@qwik.dev/core";
import { Select, t, VisibilitySelector } from "~/core/ui";
import type { Deal } from "../schema";

/**
 * Who may see a deal (visibility) and who may see its steps (a minimum membership tier), for
 * the new and edit forms.
 */
export const AccessFields = component$<{
	visibilities: readonly Deal["visibility"][];
	visibility?: Deal["visibility"];
	requiredMembershipTier?: Deal["requiredMembershipTier"];
}>(({ visibilities, visibility = "public", requiredMembershipTier = null }) => (
	<>
		<VisibilitySelector value={visibility} options={visibilities} />
		<Select
			name="requiredMembershipTier"
			label={t("deals.admin.access.requiredTier")}
			value={requiredMembershipTier ?? ""}
		>
			<option value="">{t("deals.admin.access.noTier")}</option>
			<option value="associated">{t("deals.admin.access.associated")}</option>
			<option value="full">{t("deals.admin.access.full")}</option>
		</Select>
		<p class="text-sm text-gray-500 -mt-3">
			{t("deals.admin.access.requiredTierHint")}
		</p>
	</>
));

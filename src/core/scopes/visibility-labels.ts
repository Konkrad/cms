import { t } from "~/core/i18n";
import type { Visibility } from "./visibility";

/** Labels for each visibility (kept apart from visibility.ts, which the schema imports). */
export const VISIBILITY_LABELS: Record<
	Visibility,
	{ label: string; description: string }
> = {
	public: {
		label: t("core.visibility.public"),
		description: t("core.visibility.publicDescription"),
	},
	members: {
		label: t("core.visibility.members"),
		description: t("core.visibility.membersDescription"),
	},
	representatives: {
		label: t("core.visibility.representatives"),
		description: t("core.visibility.representativesDescription"),
	},
};

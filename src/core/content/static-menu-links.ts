import { t } from "~/core/i18n";
import { activeMenuLinks } from "~/core/registry/manifests";
import type { MenuLink } from "~/core/router/modules";

export type StaticMenuLink = MenuLink;

// Curated list of global static routes that do not come from the pages table.
const CORE_MENU_LINKS: StaticMenuLink[] = [
	{ key: "events", label: t("core.menu.events"), url: "/events" },
	{
		key: "communities",
		label: t("core.menu.communities"),
		url: "/communities",
	},
	{ key: "archive", label: t("core.menu.archive"), url: "/archive/all" },
	{ key: "login", label: t("core.menu.login"), url: "/login" },
];

/** Core static links plus the menu links of active modules. */
export const getStaticMenuLinks = (): StaticMenuLink[] => [
	...CORE_MENU_LINKS,
	...activeMenuLinks,
];

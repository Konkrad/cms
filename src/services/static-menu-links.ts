import type { MenuLink } from "~/core/modules";
import { activeMenuLinks } from "~/modules";

export type StaticMenuLink = MenuLink;

// Curated list of global static routes that do not come from the pages table.
const CORE_MENU_LINKS: StaticMenuLink[] = [
	{ key: "events", label: "Events", url: "/events" },
	{ key: "elections", label: "Elections", url: "/elections" },
	{ key: "communities", label: "Communities", url: "/communities" },
	{ key: "archive-posts", label: "Archive", url: "/archive/posts" },
	{ key: "login", label: "Login", url: "/login" },
];

/** Core static links plus the menu links of active modules. */
export const getStaticMenuLinks = (): StaticMenuLink[] => [
	...CORE_MENU_LINKS,
	...activeMenuLinks,
];

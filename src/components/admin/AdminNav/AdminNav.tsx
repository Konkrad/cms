import { component$ } from "@qwik.dev/core";
import { Link, useLocation } from "@qwik.dev/router";

interface NavItem {
	order: number;
	href: string;
	label: string;
	exact?: boolean;
}

interface AdminNavProps {
	groupSlug?: string;
	isGlobal?: boolean;
	/** Admin sections contributed by active modules (global admin only). */
	sections?: { path: string; label: string; order?: number }[];
}

export const AdminNav = component$<AdminNavProps>(
	({ groupSlug, isGlobal = true, sections = [] }) => {
		const location = useLocation();
		const currentPath = location.url.pathname;

		// Determine base path for navigation
		const basePath =
			isGlobal || !groupSlug ? "/admin/global" : `/admin/${groupSlug}`;

		// Every entry has a fixed sort number so module sections can sit between core entries
		// (e.g. Deals/Jobs between Groups and Elections). Sections without `order` go last.
		const navItems: NavItem[] = [
			{ order: 0, href: basePath, label: "Dashboard", exact: true },
			{ order: 10, href: `${basePath}/users`, label: "Users" },
			{ order: 20, href: `${basePath}/posts`, label: "Posts" },
			{ order: 30, href: `${basePath}/events`, label: "Events" },
			{ order: 40, href: `${basePath}/forms`, label: "Forms" },
		];

		// Global admin only: core entries plus sections contributed by active modules
		if (isGlobal) {
			navItems.push(
				{ order: 50, href: `${basePath}/pages`, label: "Pages" },
				{ order: 60, href: "/admin/global/groups", label: "Groups" },
				{ order: 200, href: "/admin/global/elections", label: "Elections" },
			);
			for (const section of sections) {
				navItems.push({
					order: section.order ?? 1000,
					href: `/admin/global/${section.path}`,
					label: section.label,
				});
			}
		}
		navItems.sort((a, b) => a.order - b.order);

		return (
			<nav class="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
				<div class="flex gap-2 min-w-max">
					{navItems.map((item) => {
						const isActive = item.exact
							? currentPath === item.href || currentPath === `${item.href}/`
							: currentPath.startsWith(item.href);

						return (
							<Link
								key={item.href}
								href={item.href}
								class={`px-4 py-2 rounded transition-colors whitespace-nowrap ${
									isActive
										? "bg-slate-700 text-white"
										: "text-slate-300 hover:bg-slate-700 hover:text-white"
								}`}
							>
								{item.label}
							</Link>
						);
					})}
				</div>
			</nav>
		);
	},
);

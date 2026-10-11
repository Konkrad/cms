import { component$ } from "@qwik.dev/core";
import { Link, useLocation } from "@qwik.dev/router";

interface NavItem {
	order: number;
	href: string;
	label: string;
	exact?: boolean;
}

interface AdminNavProps {
	/** Admin base URL of the current scope, e.g. "/admin/root". */
	basePath: string;
	/** The current scope is the root: show the system sections. */
	isRoot: boolean;
	/** Admin sections contributed by active modules and visible in this scope. */
	sections?: { path: string; label: string; order?: number }[];
}

export const AdminNav = component$<AdminNavProps>(
	({ basePath, isRoot, sections = [] }) => {
		const location = useLocation();
		const currentPath = location.url.pathname;

		// Every entry has a fixed sort number so module sections can sit between core entries
		// (e.g. Deals/Jobs between Groups and Qualifications). Sections without `order` go last.
		const navItems: NavItem[] = [
			{ order: 0, href: basePath, label: "Dashboard", exact: true },
			{ order: 40, href: `${basePath}/forms`, label: "Forms" },
			{ order: 50, href: `${basePath}/pages`, label: "Pages" },
			{
				order: 60,
				href: `${basePath}/scope`,
				label: isRoot ? "Groups" : "Group settings",
			},
		];
		// The members of a group (public profiles); the root has the users view instead.
		if (!isRoot) {
			navItems.push({
				order: 10,
				href: `${basePath}/members`,
				label: "Members",
			});
		}

		// System sections: root only
		if (isRoot) {
			navItems.push(
				{ order: 10, href: `${basePath}/users`, label: "Users" },
				{
					order: 900,
					href: `${basePath}/notifications`,
					label: "Notifications",
				},
			);
		}
		// Sections contributed by active modules (the layout passes only those visible in this scope)
		for (const section of sections) {
			navItems.push({
				order: section.order ?? 1000,
				href: `${basePath}/${section.path}`,
				label: section.label,
			});
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

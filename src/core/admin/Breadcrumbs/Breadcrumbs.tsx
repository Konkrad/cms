import { component$ } from "@qwik.dev/core";
import { Link, useLocation } from "@qwik.dev/router";

interface BreadcrumbsProps {
	/** Admin base URL of the current scope, e.g. "/admin/germany.berlin". */
	basePath: string;
	/** Name of the current scope; omitted on the root. */
	scopeName?: string;
}

export const Breadcrumbs = component$<BreadcrumbsProps>(
	({ basePath, scopeName }) => {
		const location = useLocation();
		const currentPath = location.url.pathname;

		// Parse path segments
		const segments = currentPath.split("/").filter((s) => s);

		// Build breadcrumb items
		const breadcrumbs: Array<{ label: string; href?: string }> = [];

		// Always start with Admin
		breadcrumbs.push({ label: "Admin", href: "/admin" });
		breadcrumbs.push(
			scopeName
				? { label: scopeName, href: basePath }
				: { label: "Platform Admin", href: basePath },
		);

		// Add specific section breadcrumbs
		if (segments.includes("events")) {
			breadcrumbs.push({ label: "Events" });
			if (segments.includes("new")) {
				breadcrumbs.push({ label: "New Event" });
			} else if (segments.includes("edit")) {
				breadcrumbs.push({ label: "Edit Event" });
			}
		} else if (segments.includes("posts")) {
			breadcrumbs.push({ label: "Posts" });
			if (segments.includes("new")) {
				breadcrumbs.push({ label: "New Post" });
			} else if (segments.includes("edit")) {
				breadcrumbs.push({ label: "Edit Post" });
			}
		} else if (segments.includes("users")) {
			breadcrumbs.push({ label: "Users" });
		} else if (segments.includes("pages")) {
			breadcrumbs.push({ label: "Pages" });
		} else if (segments.includes("notifications")) {
			breadcrumbs.push({ label: "Notifications" });
		}

		return (
			<nav class="flex items-center space-x-2 text-sm text-gray-600 mb-4">
				{breadcrumbs.map((crumb, index) => (
					<span key={index} class="flex items-center">
						{index > 0 && <span class="mx-2">/</span>}
						{crumb.href ? (
							<Link href={crumb.href} class="hover:text-gray-900 underline">
								{crumb.label}
							</Link>
						) : (
							<span class="text-gray-900 font-medium">{crumb.label}</span>
						)}
					</span>
				))}
			</nav>
		);
	},
);

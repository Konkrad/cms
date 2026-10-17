import { component$ } from "@qwik.dev/core";
import { Link, useLocation } from "@qwik.dev/router";
import { t } from "~/core/i18n";

interface BreadcrumbsProps {
	/** The scope and its ancestors, root first; `href` where the user may open that admin. */
	trail: Array<{ label: string; href?: string }>;
}

export const Breadcrumbs = component$<BreadcrumbsProps>(({ trail }) => {
	const location = useLocation();
	const currentPath = location.url.pathname;

	// Parse path segments
	const segments = currentPath.split("/").filter((s) => s);

	// Build breadcrumb items
	const breadcrumbs: Array<{ label: string; href?: string }> = [];

	// Always start with Admin
	breadcrumbs.push(
		{ label: t("admin.breadcrumbs.admin"), href: "/admin" },
		...trail,
	);

	// Add specific section breadcrumbs
	if (segments.includes("events")) {
		breadcrumbs.push({ label: t("admin.nav.events") });
		if (segments.includes("new")) {
			breadcrumbs.push({ label: t("admin.breadcrumbs.newEvent") });
		} else if (segments.includes("edit")) {
			breadcrumbs.push({ label: t("admin.breadcrumbs.editEvent") });
		}
	} else if (segments.includes("notes")) {
		breadcrumbs.push({ label: t("admin.nav.notes") });
		if (segments.includes("edit"))
			breadcrumbs.push({ label: t("admin.breadcrumbs.editNote") });
	} else if (segments.includes("articles")) {
		breadcrumbs.push({ label: t("admin.nav.articles") });
		if (segments.includes("new")) {
			breadcrumbs.push({ label: t("admin.breadcrumbs.newArticle") });
		} else if (segments.includes("edit")) {
			breadcrumbs.push({ label: t("admin.breadcrumbs.editArticle") });
		}
	} else if (segments.includes("users")) {
		breadcrumbs.push({ label: t("admin.nav.users") });
	} else if (segments.includes("pages")) {
		breadcrumbs.push({ label: t("admin.nav.pages") });
	} else if (segments.includes("notifications")) {
		breadcrumbs.push({ label: t("admin.nav.notifications") });
	} else if (segments.includes("members")) {
		breadcrumbs.push({ label: t("admin.nav.members") });
	} else if (segments[2] && segments[3] === "scope") {
		breadcrumbs.push({ label: t("admin.nav.groupSettings") });
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
});

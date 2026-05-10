import { component$ } from "@qwik.dev/core";
import { useLocation } from "@qwik.dev/router";

interface BreadcrumbsProps {
  groupSlug?: string;
  groupName?: string;
}

export const Breadcrumbs = component$<BreadcrumbsProps>(
  ({ groupSlug, groupName }) => {
    const location = useLocation();
    const currentPath = location.url.pathname;

    // Parse path segments
    const segments = currentPath.split("/").filter((s) => s);

    // Build breadcrumb items
    const breadcrumbs: Array<{ label: string; href?: string }> = [];

    // Always start with Admin
    breadcrumbs.push({ label: "Admin", href: "/admin/global" });

    // Handle global vs group context
    if (segments.includes("global")) {
      breadcrumbs.push({ label: "Platform Admin" });
    } else if (groupSlug && groupName) {
      breadcrumbs.push({ label: groupName, href: `/admin/${groupSlug}` });
    }

    // Add specific section breadcrumbs
    if (segments.includes("groups")) {
      breadcrumbs.push({ label: "Groups", href: "/admin/global/groups" });
      if (segments.includes("new")) {
        breadcrumbs.push({ label: "New Group" });
      } else if (segments.includes("edit")) {
        breadcrumbs.push({ label: "Edit Group" });
      } else if (segments.includes("members")) {
        breadcrumbs.push({ label: "Members" });
      }
    } else if (segments.includes("events")) {
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
    }

    return (
      <nav class="flex items-center space-x-2 text-sm text-gray-600 mb-4">
        {breadcrumbs.map((crumb, index) => (
          <span key={index} class="flex items-center">
            {index > 0 && <span class="mx-2">/</span>}
            {crumb.href ? (
              <a href={crumb.href} class="hover:text-gray-900 underline">
                {crumb.label}
              </a>
            ) : (
              <span class="text-gray-900 font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
    );
  },
);

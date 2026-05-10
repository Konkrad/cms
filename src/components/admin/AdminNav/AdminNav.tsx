import { component$ } from "@qwik.dev/core";
import { useLocation } from "@qwik.dev/router";

interface AdminNavProps {
  groupSlug?: string;
  isGlobal?: boolean;
}

export const AdminNav = component$<AdminNavProps>(({ groupSlug, isGlobal = true }) => {
  const location = useLocation();
  const currentPath = location.url.pathname;

  // Determine base path for navigation
  const basePath = isGlobal || !groupSlug ? "/admin/global" : `/admin/${groupSlug}`;

  const navItems = [
    { href: basePath, label: "Dashboard", exact: true },
    { href: `${basePath}/users`, label: "Users" },
    { href: `${basePath}/posts`, label: "Posts" },
    { href: `${basePath}/events`, label: "Events" },
    { href: `${basePath}/forms`, label: "Forms" },
  ];

  // Add Pages link only for global admin
  if (isGlobal) {
    navItems.push({ href: `${basePath}/pages`, label: "Pages" });
  }

  // Add Groups management for global admin
  if (isGlobal) {
    navItems.push({ href: `/admin/global/groups`, label: "Groups" });
  }

  return (
    <nav class="flex gap-2">
      {navItems.map((item) => {
        const isActive = item.exact
          ? currentPath === item.href || currentPath === `${item.href}/`
          : currentPath.startsWith(item.href);

        return (
          <a
            key={item.href}
            href={item.href}
            class={`px-4 py-2 rounded transition-colors ${
              isActive
                ? "bg-slate-700 text-white"
                : "text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
});

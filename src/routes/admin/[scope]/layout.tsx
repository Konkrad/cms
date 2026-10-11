import { component$, Slot } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button/Button";
import { AdminNav } from "~/core/admin/AdminNav";
import { Breadcrumbs } from "~/core/admin/Breadcrumbs";
import { ScopeSwitcher } from "~/core/admin/ScopeSwitcher";
import { ROOT_ONLY_SECTIONS } from "~/core/admin/sections";
import { activeAdminSections } from "~/core/registry/manifests";
import { adminUrl, scopeUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	listManagedScopes,
	requireScopeRole,
} from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

/** Module sections declared only for the root ("global"). */
const moduleRootOnly = activeAdminSections
	.filter((s) => s.scopes !== "all")
	.map((s) => s.path);

/**
 * The admin shell of one scope (`/admin/[scope]/…`): authorizes a managing role on the scope
 * (inherited downward), answers 404 for a root-only section opened on another scope, and
 * builds the scope switcher (scopes the user manages) and the scope trail for the breadcrumbs.
 */
export const useScopeAdmin = routeLoader$(async (event) => {
	const { user, scope, ancestors } = await requireScopeRole(
		event,
		ADMIN_ACCESS,
	);
	const isRoot = scope.parentId === null;
	const section = event.url.pathname.split("/")[3] ?? "";
	if (
		!isRoot &&
		(ROOT_ONLY_SECTIONS.includes(section) || moduleRootOnly.includes(section))
	) {
		throw event.error(404, "Not found");
	}

	const managed = await listManagedScopes(user);
	const managedIds = new Set(managed.map((s) => s.id));
	const label = (s: { parentId: string | null; name: string }) =>
		s.parentId === null ? "Platform" : s.name;
	return assertNoPrivateFields({
		isRoot,
		scope: {
			id: scope.id,
			name: scope.name,
			kind: scope.kind,
			path: scope.path,
		},
		adminBase: adminUrl(scope.path),
		// Ancestors link to their admin only where the user manages them.
		trail: [...ancestors, scope].map((s) => ({
			label: label(s),
			href: managedIds.has(s.id) ? adminUrl(s.path) : undefined,
		})),
		switcher: managed.map((s) => ({
			id: s.id,
			label: label(s),
			kind: s.kind,
			depth: s.path.split("/").filter(Boolean).length,
			href: adminUrl(s.path),
		})),
		// Module sections declared for every scope ("all"); the root shows them all.
		adminSections: isRoot
			? activeAdminSections
			: activeAdminSections.filter((s) => s.scopes === "all"),
	});
});

export default component$(() => {
	const admin = useScopeAdmin();

	return (
		<div class="min-h-screen bg-gray-50">
			<div class="bg-slate-800 text-white shadow-lg">
				<div class="max-w-7xl mx-auto px-4 py-6">
					<div class="flex items-start justify-between gap-4 mb-4">
						<div class="min-w-0">
							<h1 class="text-2xl sm:text-3xl font-bold truncate">
								{admin.value.isRoot
									? "Platform Admin"
									: `${admin.value.scope.name} Admin`}
							</h1>
							{!admin.value.isRoot && (
								<p class="text-slate-300 text-sm mt-1 capitalize">
									{admin.value.scope.kind}
								</p>
							)}
						</div>
						<div class="flex gap-2 shrink-0 items-start">
							<ScopeSwitcher
								current={admin.value.scope.id}
								scopes={admin.value.switcher}
							/>
							{!admin.value.isRoot && (
								<Button
									href={scopeUrl(admin.value.scope.path)}
									variant="secondary"
									size="sm"
								>
									View Group
								</Button>
							)}
							<Button href="/" variant="secondary" size="sm">
								Back to Site
							</Button>
						</div>
					</div>
					<AdminNav
						basePath={admin.value.adminBase}
						isRoot={admin.value.isRoot}
						sections={admin.value.adminSections}
					/>
				</div>
			</div>
			<div class="max-w-7xl mx-auto px-4 py-8">
				<Breadcrumbs trail={admin.value.trail} />
				<Slot />
			</div>
		</div>
	);
});

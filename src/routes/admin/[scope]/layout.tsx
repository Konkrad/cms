import { component$, Slot } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button/Button";
import { AdminNav } from "~/core/admin/AdminNav";
import { Breadcrumbs } from "~/core/admin/Breadcrumbs";
import { ScopeSwitcher } from "~/core/admin/ScopeSwitcher";
import { ROOT_ONLY_SECTIONS } from "~/core/admin/sections";
import { t } from "~/core/i18n";
import { activeAdminSections } from "~/core/registry/manifests";
import { sectionAllowedOn } from "~/core/router/modules";
import { adminUrl, scopeUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	canManageScope,
	listManagedScopes,
	REVIEW_ACCESS,
	requireScopeRole,
} from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

/**
 * The admin shell of one scope (`/admin/[scope]/…`): authorizes a managing role on the scope
 * (inherited downward), answers 404 for a section that does not exist on this scope (a core
 * system section on another scope than the root, a module section whose manifest `scopes`
 * rule excludes the scope's kind), and builds the scope switcher (scopes the user manages)
 * and the scope trail for the breadcrumbs.
 */
export const useScopeAdmin = routeLoader$(async (event) => {
	const section = event.url.pathname.split("/")[3] ?? "";
	// The review queue is also open to coordinators, who have no other admin section.
	const { user, scope, ancestors } = await requireScopeRole(
		event,
		section === "reviews" ? REVIEW_ACCESS : ADMIN_ACCESS,
	);
	const isRoot = scope.parentId === null;
	const reviewOnly = !(await canManageScope(user, scope.id, ADMIN_ACCESS));
	const moduleSection = activeAdminSections.find((s) => s.path === section);
	if (
		(!isRoot && ROOT_ONLY_SECTIONS.includes(section)) ||
		(moduleSection && !sectionAllowedOn(moduleSection, scope))
	) {
		throw event.error(404, "Not found");
	}

	const managed = await listManagedScopes(user);
	const managedIds = new Set(managed.map((s) => s.id));
	// Coordinators switch between the review queues of the scopes they review.
	const switchable = await listManagedScopes(user, REVIEW_ACCESS);
	const label = (s: { parentId: string | null; name: string }) =>
		s.parentId === null ? t("admin.layout.platform") : s.name;
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
		switcher: switchable.map((s) => ({
			id: s.id,
			label: label(s),
			kind: s.kind,
			depth: s.path.split("/").filter(Boolean).length,
			href: managedIds.has(s.id)
				? adminUrl(s.path)
				: adminUrl(s.path, "reviews"),
		})),
		reviewOnly,
		// Module sections that exist on this scope (manifest `scopes`: root, all or kinds).
		adminSections: activeAdminSections
			.filter((s) => sectionAllowedOn(s, scope))
			.map(({ path, label, order }) => ({ path, label, order })),
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
									? t("admin.layout.platformAdmin")
									: t("admin.layout.admin", { name: admin.value.scope.name })}
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
									{t("admin.layout.viewGroup")}
								</Button>
							)}
							<Button href="/" variant="secondary" size="sm">
								{t("admin.layout.backToSite")}
							</Button>
						</div>
					</div>
					<AdminNav
						basePath={admin.value.adminBase}
						isRoot={admin.value.isRoot}
						reviewOnly={admin.value.reviewOnly}
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

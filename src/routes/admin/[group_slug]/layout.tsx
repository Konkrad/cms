import { component$, Slot } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button/Button";
import { AdminNav } from "~/core/admin/AdminNav";
import { Breadcrumbs } from "~/core/admin/Breadcrumbs";
import { getCurrentUserData } from "~/core/auth/server-auth";
import { activeAdminSections } from "~/core/registry/manifests";
import { adminUrl, scopeUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	isPlatformAdmin,
	requireScopeRole,
} from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

export const useGroupAdminAuth = routeLoader$(async (event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const isRoot = scope.parentId === null;
	return assertNoPrivateFields({
		isRoot,
		scope: { id: scope.id, name: scope.name, path: scope.path },
		adminBase: adminUrl(scope.path),
		// Module sections declared for every scope ("all"); the root shows them all.
		adminSections: isRoot
			? activeAdminSections
			: activeAdminSections.filter((s) => s.scopes === "all"),
	});
});

export default component$(() => {
	const auth = useGroupAdminAuth();

	return (
		<div class="min-h-screen bg-gray-50">
			<div class="bg-slate-800 text-white shadow-lg">
				<div class="max-w-7xl mx-auto px-4 py-6">
					<div class="flex items-start justify-between gap-4 mb-4">
						<div class="min-w-0">
							<h1 class="text-2xl sm:text-3xl font-bold truncate">
								{auth.value.isRoot
									? "Platform Admin"
									: `${auth.value.scope.name} Admin`}
							</h1>
							{!auth.value.isRoot && (
								<p class="text-slate-300 text-sm mt-1">
									Community Representative Dashboard
								</p>
							)}
						</div>
						<div class="flex gap-2 shrink-0">
							{!auth.value.isRoot && (
								<Button
									href={scopeUrl(auth.value.scope.path)}
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
						basePath={auth.value.adminBase}
						isRoot={auth.value.isRoot}
						sections={auth.value.adminSections}
					/>
				</div>
			</div>
			<div class="max-w-7xl mx-auto px-4 py-8">
				<Breadcrumbs
					basePath={auth.value.adminBase}
					scopeName={auth.value.isRoot ? undefined : auth.value.scope.name}
				/>
				<Slot />
			</div>
		</div>
	);
});

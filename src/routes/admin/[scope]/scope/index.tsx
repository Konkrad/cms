import { component$ } from "@qwik.dev/core";
import {
	Form,
	Link,
	routeAction$,
	routeLoader$,
	z,
	zod$,
} from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { Input } from "~/components/ui/Input";
import { t } from "~/core/i18n";
import { publicImageUrlFromKey } from "~/core/media/images";
import { reservedSlugs, scopeHasContent } from "~/core/registry/manifests";
import { adminUrl, scopeUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	canManageScope,
	isPlatformAdmin,
	requestScope,
	requireAdmin,
	requireScopeRole,
} from "~/core/scopes/access";
import { ScopeError, scopesService } from "~/core/scopes/scopes.service";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { env } from "~/env";

/** Why a scope cannot be deleted, or null when it can (by this user). */
async function deleteBlocker(
	user: { id: string },
	scope: { id: string; parentId: string | null },
): Promise<string | null> {
	if (scope.parentId === null) return t("admin.scope.rootCannotDelete");
	if (!(await canManageScope(user, scope.parentId, ADMIN_ACCESS)))
		return t("admin.scope.onlyParentManagersDelete");
	if ((await scopesService.getChildren(scope.id)).length > 0)
		return t("admin.scope.moveGroupsFirst");
	if (await scopeHasContent(scope.id)) return t("admin.scope.stillHasContent");
	return null;
}

/** Settings of the URL's scope: name, description, images, child groups, delete and move. */
export const useScopeSettings = routeLoader$(async (event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const isRoot = scope.parentId === null;
	const [children, blocker, platformAdmin] = await Promise.all([
		scopesService.getChildrenWithMemberCounts(scope.id),
		deleteBlocker(user, scope),
		isPlatformAdmin(user),
	]);
	const canMove = platformAdmin && !isRoot;
	const moveTargets = canMove
		? (await scopesService.listScopesWithRole(user.id, ["admin", "moderator"]))
				.filter(
					(s) => !s.path.startsWith(scope.path) && s.id !== scope.parentId,
				)
				.map((s) => ({
					id: s.id,
					label: s.parentId ? s.path : t("admin.scope.root"),
				}))
		: [];
	return assertNoPrivateFields({
		scope: {
			id: scope.id,
			name: scope.name,
			kind: scope.kind,
			slug: scope.slug,
			path: scope.path,
			description: scope.description,
			images: [scope.image1, scope.image2, scope.image3].map((key) =>
				publicImageUrlFromKey(key),
			),
		},
		isRoot,
		base: adminUrl(scope.path),
		publicUrl: scopeUrl(scope.path),
		children: children.map((c) => ({
			id: c.id,
			name: c.name,
			kind: c.kind,
			slug: c.slug,
			memberCount: c.memberCount,
			adminHref: adminUrl(c.path),
			publicHref: scopeUrl(c.path),
		})),
		kinds: [...env.SCOPE_KINDS],
		deleteBlocker: blocker,
		canMove,
		moveTargets,
	});
});

export const useUpdateScope = routeAction$(
	async (data, event) => {
		const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
		await scopesService.updateProfile(scope.id, {
			name: data.name,
			description: data.description ?? null,
		});
		return { success: true };
	},
	zod$({
		name: z.string().trim().min(1, t("admin.scope.nameRequired")).max(120),
		description: z.string().max(2000).optional(),
	}),
);

export const useSetScopeImage = routeAction$(
	async (data, event) => {
		const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
		try {
			const slot = Number(data.slot) as 1 | 2 | 3;
			await scopesService.setImage(scope.id, slot, data.key || null);
		} catch (error) {
			if (error instanceof ScopeError)
				return event.fail(400, { message: error.message });
			throw error;
		}
		return { success: true };
	},
	zod$({
		slot: z.enum(["1", "2", "3"]),
		key: z.string().max(300).optional(),
	}),
);

export const useCreateChildScope = routeAction$(
	async (data, event) => {
		const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
		let child: Awaited<ReturnType<typeof scopesService.create>>;
		try {
			child = await scopesService.create(
				{
					parentId: scope.id,
					kind: data.kind,
					slug: data.slug,
					name: data.name,
				},
				reservedSlugs,
			);
		} catch (error) {
			if (error instanceof ScopeError)
				return event.fail(400, { message: error.message });
			throw error;
		}
		throw event.redirect(303, adminUrl(child.path, "/scope"));
	},
	zod$({
		// One of the configured kinds (env.SCOPE_KINDS).
		kind: z.string().refine((kind) => env.SCOPE_KINDS.includes(kind), {
			message: t("admin.scope.unknownKind"),
		}),
		slug: z.string().trim().toLowerCase().min(1).max(63),
		name: z.string().trim().min(1, t("admin.scope.nameRequired")).max(120),
	}),
);

export const useDeleteScope = routeAction$(async (_data, event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const blocker = await deleteBlocker(user, scope);
	if (blocker) return event.fail(400, { message: blocker });
	const parent = scope.parentId
		? await scopesService.getById(scope.parentId)
		: undefined;
	await scopesService.delete(scope.id);
	throw event.redirect(303, adminUrl(parent?.path ?? "/", "/scope"));
});

/** Moving a scope (re-parenting its whole subtree) is for platform admins only. */
export const useMoveScope = routeAction$(
	async (data, event) => {
		await requireAdmin(event);
		const scope = await requestScope(event);
		if (!scope) throw event.error(404, "Not found");
		let moved: Awaited<ReturnType<typeof scopesService.move>>;
		try {
			moved = await scopesService.move(scope.id, data.parentId);
		} catch (error) {
			if (error instanceof ScopeError)
				return event.fail(400, { message: error.message });
			throw error;
		}
		throw event.redirect(303, adminUrl(moved.path, "/scope"));
	},
	zod$({ parentId: z.string().min(1) }),
);

/**
 * Changing a scope's slug changes the URLs of its whole subtree (the old ones redirect), so it
 * is for platform admins only, like moving.
 */
export const useRenameScope = routeAction$(
	async (data, event) => {
		await requireAdmin(event);
		const scope = await requestScope(event);
		if (!scope) throw event.error(404, "Not found");
		let renamed: Awaited<ReturnType<typeof scopesService.changeSlug>>;
		try {
			renamed = await scopesService.changeSlug(
				scope.id,
				data.newSlug,
				reservedSlugs,
			);
		} catch (error) {
			if (error instanceof ScopeError)
				return event.fail(400, { message: error.message });
			throw error;
		}
		throw event.redirect(303, adminUrl(renamed.path, "/scope"));
	},
	zod$({ newSlug: z.string().trim().toLowerCase().min(1).max(63) }),
);

export default component$(() => {
	const data = useScopeSettings();
	const rename = useRenameScope();
	const update = useUpdateScope();
	const setImage = useSetScopeImage();
	const create = useCreateChildScope();
	const remove = useDeleteScope();
	const move = useMoveScope();
	const { scope } = data.value;

	return (
		<div class="space-y-8">
			<div class="flex items-center justify-between">
				<h2 class="text-2xl font-bold text-gray-800">
					{data.value.isRoot
						? t("admin.scope.groups")
						: t("admin.scope.groupSettings")}
				</h2>
				{!data.value.isRoot && (
					<Button href={data.value.publicUrl} variant="secondary">
						{t("admin.scope.viewPage")}
					</Button>
				)}
			</div>

			<section class="bg-white rounded-lg shadow-sm p-6 space-y-4">
				<h3 class="text-lg font-semibold text-gray-900">
					{t("admin.scope.profile")}
				</h3>
				<p class="text-sm text-gray-500">
					<span class="capitalize">{scope.kind}</span> · {scope.path}
				</p>
				<Form action={update} class="space-y-4">
					<Input
						name="name"
						label={t("admin.scope.name")}
						value={scope.name}
						required
					/>
					<div>
						<label
							for="scope-description"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							{t("admin.scope.description")}
						</label>
						<textarea
							id="scope-description"
							name="description"
							rows={3}
							class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
							value={scope.description ?? ""}
						/>
					</div>
					{update.value?.success && (
						<p class="text-sm text-green-700">{t("admin.scope.saved")}</p>
					)}
					<Button type="submit">{t("admin.scope.save")}</Button>
				</Form>
			</section>

			{!data.value.isRoot && (
				<section class="bg-white rounded-lg shadow-sm p-6 space-y-4">
					<h3 class="text-lg font-semibold text-gray-900">
						{t("admin.scope.pageImages")}
					</h3>
					{setImage.value?.failed && (
						<p class="text-sm text-red-600">{setImage.value.message}</p>
					)}
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						{([1, 2, 3] as const).map((slot) => {
							const current = scope.images[slot - 1];
							return (
								<div key={slot} class="space-y-2">
									<p class="text-sm font-medium text-gray-700">
										{t("admin.scope.image", { slot })}
									</p>
									{current && (
										<img
											src={current}
											alt=""
											width="400"
											height="300"
											class="w-full rounded-sm object-cover"
											style={{ aspectRatio: slot === 2 ? "4/3" : "1/1" }}
										/>
									)}
									<ImageUploader
										path="public/scopes"
										autoUpload
										crop
										aspectRatio={slot === 2 ? "4/3" : "1/1"}
										cropAspectRatio={slot === 2 ? "4/3" : "1/1"}
										onFileUploaded$={async (file) => {
											if (file.filePath)
												await setImage.submit({
													slot: String(slot) as "1" | "2" | "3",
													key: file.filePath,
												});
										}}
									/>
									{current && (
										<Form action={setImage}>
											<input type="hidden" name="slot" value={String(slot)} />
											<button
												type="submit"
												class="text-sm text-red-600 hover:underline"
											>
												{t("admin.scope.removeImage")}
											</button>
										</Form>
									)}
								</div>
							);
						})}
					</div>
				</section>
			)}

			<section class="bg-white rounded-lg shadow-sm p-6 space-y-4">
				<h3 class="text-lg font-semibold text-gray-900">
					{t("admin.scope.groupsBelow")}
				</h3>
				{data.value.children.length === 0 ? (
					<p class="text-sm text-gray-500">{t("admin.scope.noGroupsYet")}</p>
				) : (
					<table class="min-w-full divide-y divide-gray-200 text-sm">
						<thead>
							<tr class="text-left text-xs uppercase text-gray-500">
								<th class="py-2">{t("admin.scope.name")}</th>
								<th class="py-2">{t("admin.scope.kind")}</th>
								<th class="py-2">{t("admin.scope.members")}</th>
								<th class="py-2" />
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{data.value.children.map((child) => (
								<tr key={child.id}>
									<td class="py-2 font-medium">{child.name}</td>
									<td class="py-2 capitalize">{child.kind}</td>
									<td class="py-2">{child.memberCount}</td>
									<td class="py-2 text-right space-x-3">
										<Link
											href={child.adminHref}
											class="text-blue-600 hover:underline"
										>
											{t("admin.scope.manage")}
										</Link>
										<a
											href={child.publicHref}
											class="text-gray-600 hover:underline"
										>
											{t("admin.scope.view")}
										</a>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}

				<Form
					action={create}
					class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
				>
					<div>
						<label
							for="child-kind"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							{t("admin.scope.kind")}
						</label>
						<select
							id="child-kind"
							name="kind"
							class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
						>
							{data.value.kinds.map((k) => (
								<option key={k} value={k}>
									{k}
								</option>
							))}
						</select>
					</div>
					<Input name="name" label={t("admin.scope.name")} required />
					<Input
						name="slug"
						label={t("admin.scope.urlSlug")}
						placeholder={t("admin.scope.eGBerlin")}
						required
					/>
					<Button type="submit">{t("admin.scope.createGroup")}</Button>
				</Form>
				{create.value?.failed && (
					<p class="text-sm text-red-600" role="alert">
						{create.value.message ??
							Object.values(create.value.fieldErrors ?? {})
								.flat()
								.join(" ")}
					</p>
				)}
			</section>

			{data.value.canMove && (
				<section class="bg-white rounded-lg shadow-sm p-6 space-y-4">
					<h3 class="text-lg font-semibold text-gray-900">
						{t("admin.scope.move")}
					</h3>
					<Form action={move} class="flex gap-3 items-end">
						<div>
							<label
								for="move-parent"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								{t("admin.scope.newParent")}
							</label>
							<select
								id="move-parent"
								name="parentId"
								class="rounded border border-gray-300 px-3 py-2 text-sm"
							>
								{data.value.moveTargets.map((target) => (
									<option key={target.id} value={target.id}>
										{target.label}
									</option>
								))}
							</select>
						</div>
						<Button type="submit" variant="secondary">
							{t("admin.scope.moveGroup")}
						</Button>
					</Form>
					{move.value?.failed && (
						<p class="text-sm text-red-600">{move.value.message}</p>
					)}
					<Form action={rename} class="flex gap-3 items-end">
						<div>
							<label
								for="rename-slug"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								{t("admin.scope.urlSegment")}
							</label>
							<input
								id="rename-slug"
								name="newSlug"
								value={scope.slug}
								class="rounded border border-gray-300 px-3 py-2 text-sm"
							/>
						</div>
						<Button type="submit" variant="secondary">
							{t("admin.scope.changeUrl")}
						</Button>
					</Form>
					{rename.value?.failed && (
						<p class="text-sm text-red-600">{rename.value.message}</p>
					)}
					<p class="text-sm text-gray-500">
						{t("admin.scope.oldUrlsOfThisGroup")}
					</p>
				</section>
			)}

			{!data.value.isRoot && (
				<section class="bg-white rounded-lg shadow-sm p-6 space-y-3">
					<h3 class="text-lg font-semibold text-gray-900">
						{t("admin.scope.delete")}
					</h3>
					{data.value.deleteBlocker ? (
						<p class="text-sm text-gray-500">{data.value.deleteBlocker}</p>
					) : (
						<Form action={remove}>
							<Button type="submit" variant="secondary">
								{t("admin.scope.deleteThisGroup")}
							</Button>
						</Form>
					)}
					{remove.value?.failed && (
						<p class="text-sm text-red-600">{remove.value.message}</p>
					)}
				</section>
			)}
		</div>
	);
});

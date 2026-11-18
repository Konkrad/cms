import { component$ } from "@qwik.dev/core";
import {
	Form,
	Link,
	routeAction$,
	routeLoader$,
	z,
	zod$,
} from "@qwik.dev/router";
import { AdminTable } from "~/components/ui/AdminTable";
import { Button } from "~/components/ui/Button";
import { formResultsService } from "~/core/forms/form-results.service";
import { buildFormPath } from "~/core/forms/forms";
import {
	FormInputError,
	formAssignmentsService,
	formsService,
} from "~/core/forms/forms.service";
import { isSurveyForm } from "~/core/forms/purposes";
import { formatDate, t } from "~/core/i18n";
import { formPurposes, isFormPurpose } from "~/core/registry/forms";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import {
	buildFormsAdminBasePath,
	getOwnForm,
	resolveFormsAdminScope,
} from "./_utils";

export const useFormsData = routeLoader$(async (event) => {
	const { scope } = await resolveFormsAdminScope(event);
	const forms = await formsService.listOwn(scope.id);
	const responseCounts = await formResultsService.getCountsByFormIds(
		forms.map((form) => form.id),
	);

	return assertNoPrivateFields({
		forms: forms.map((form) => ({
			id: form.id,
			title: form.title,
			slug: form.slug,
			purpose: form.purpose,
			visibility: form.visibility,
			updatedAt: form.updatedAt,
			responses: responseCounts[form.id] ?? 0,
			// Workflow forms are filled in their workflow, not on a public survey page.
			publicPath: isSurveyForm(form) ? buildFormPath(form) : null,
		})),
		// The active form per purpose (spec 4.10): this scope's own choice, else the nearest
		// scope's above; the options are the forms of that purpose of this scope and its ancestors.
		purposes: await Promise.all(
			formPurposes().map(async ({ purpose, label }) => {
				const [active, own, options] = await Promise.all([
					formAssignmentsService.activeFor(purpose, scope.id),
					formAssignmentsService.listOwn(scope.id),
					formsService.listAvailable(scope.id, purpose),
				]);
				return {
					purpose,
					label,
					activeFormId: active?.id ?? null,
					activeTitle: active?.title ?? null,
					inherited: !!active && !own[purpose],
					options: options.map((f) => ({ id: f.id, title: f.title })),
				};
			}),
		),
		basePath: buildFormsAdminBasePath(event.params.scope),
	});
});

/**
 * Picks this scope's active form of a purpose (it applies to the scope and below until a scope
 * further down picks another), or clears the scope's own choice so it inherits again.
 */
export const useSetActiveForm = routeAction$(
	async (data, event) => {
		const { scope } = await resolveFormsAdminScope(event);
		if (!isFormPurpose(data.purpose))
			return event.fail(400, { message: t("admin.forms.unknownPurpose") });
		try {
			await formAssignmentsService.setActive(
				data.purpose,
				scope.id,
				data.formId || null,
			);
		} catch (error) {
			if (error instanceof FormInputError)
				return event.fail(400, { message: error.message });
			throw error;
		}
		return { success: true };
	},
	zod$({ purpose: z.string().min(1), formId: z.string().optional() }),
);

/** An editable copy of a form of this scope (how a locked form's questions are changed). */
export const useDuplicateForm = routeAction$(
	async (data, event) => {
		const { scope, userId } = await resolveFormsAdminScope(event);
		const form = await getOwnForm(scope, data.formId);
		if (!form) return event.fail(404, { message: t("admin.forms.notFound") });
		const copy = await formsService.duplicate(form.id, userId);
		throw event.redirect(
			303,
			`${buildFormsAdminBasePath(event.params.scope)}/${copy.id}/edit`,
		);
	},
	zod$({ formId: z.string().min(1) }),
);

const th =
	"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";

export default component$(() => {
	const data = useFormsData();
	const duplicate = useDuplicateForm();
	const setActive = useSetActiveForm();

	return (
		<div>
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-2xl font-bold">{t("admin.forms.manageForms")}</h2>
				<Button href={`${data.value.basePath}/new`}>
					{t("admin.forms.createNewForm")}
				</Button>
			</div>

			{data.value.purposes.length > 0 && (
				<section
					class="bg-white shadow-sm rounded-lg p-6 mb-8"
					data-testid="active-forms"
				>
					<h3 class="text-lg font-semibold mb-1">
						{t("admin.forms.activeForms")}
					</h3>
					<p class="text-sm text-gray-500 mb-4">
						{t("admin.forms.theFormEachWorkflowUses")}
					</p>
					{setActive.value?.success && (
						<output class="block text-sm text-green-700 mb-3">
							{t("admin.forms.saved")}
						</output>
					)}
					{setActive.value?.failed && (
						<p class="text-sm text-red-700 mb-3">{setActive.value.message}</p>
					)}
					<div class="space-y-3">
						{data.value.purposes.map((p) => (
							<Form
								key={p.purpose}
								action={setActive}
								class="flex flex-wrap items-center gap-3"
								data-purpose={p.purpose}
							>
								<input type="hidden" name="purpose" value={p.purpose} />
								<span class="w-48 font-medium">{p.label}</span>
								<select
									name="formId"
									class="border border-gray-300 rounded-sm px-2 py-1 text-sm"
									aria-label={t("admin.forms.activeFormFor", {
										label: p.label,
									})}
								>
									<option value="" selected={p.inherited || !p.activeFormId}>
										{p.inherited
											? t("admin.forms.inherited", {
													activeTitle: p.activeTitle ?? "",
												})
											: t("admin.forms.noneInheritFromAbove")}
									</option>
									{p.options.map((f) => (
										<option
											key={f.id}
											value={f.id}
											selected={!p.inherited && f.id === p.activeFormId}
										>
											{f.title}
										</option>
									))}
								</select>
								<button
									type="submit"
									class="text-blue-600 hover:text-blue-900 text-sm font-medium"
								>
									{t("admin.forms.save")}
								</button>
							</Form>
						))}
					</div>
				</section>
			)}

			{data.value.forms.length === 0 ? (
				<div class="bg-white shadow-sm rounded-lg p-8 text-center">
					<p class="text-gray-500">{t("admin.forms.noFormsCreatedYet")}</p>
				</div>
			) : (
				<AdminTable>
					<thead class="bg-gray-50">
						<tr>
							<th class={th}>{t("admin.forms.edit.title")}</th>
							<th class={th}>{t("admin.forms.edit.purpose")}</th>
							<th class={th}>{t("admin.forms.edit.visibility")}</th>
							<th class={th}>{t("admin.forms.updated")}</th>
							<th class={th}>{t("admin.forms.responses.responses")}</th>
							<th class={th}>{t("admin.forms.actions")}</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{data.value.forms.map((form) => (
							<tr key={form.id} data-form-id={form.id}>
								<td class="px-6 py-4 font-medium">
									{form.title}
									{form.responses > 0 && (
										<span
											class="ml-2 text-xs text-gray-500"
											title={t("admin.forms.thisFormHasAnswersIts")}
										>
											{t("admin.forms.locked")}
										</span>
									)}
								</td>
								<td class="px-6 py-4">
									{form.purpose ? (
										<code class="text-sm bg-gray-100 px-2 py-1 rounded-sm">
											{form.purpose}
										</code>
									) : (
										"-"
									)}
								</td>
								<td class="px-6 py-4 capitalize">{form.visibility}</td>
								<td class="px-6 py-4 text-sm text-gray-500">
									{formatDate(form.updatedAt)}
								</td>
								<td class="px-6 py-4 text-sm text-gray-700">
									{form.responses}
								</td>
								<td class="px-6 py-4 text-sm">
									<div class="flex gap-3 items-center">
										{form.publicPath && (
											<Link
												href={form.publicPath}
												class="text-blue-600 hover:text-blue-900"
											>
												{t("admin.forms.open")}
											</Link>
										)}
										<Link
											href={`${data.value.basePath}/${form.id}/responses`}
											class="text-purple-600 hover:text-purple-900"
										>
											{t("admin.forms.responses.responses")}
										</Link>
										<Link
											href={`${data.value.basePath}/${form.id}/edit`}
											class="text-green-600 hover:text-green-900"
										>
											{t("admin.forms.edit")}
										</Link>
										<Form action={duplicate}>
											<input type="hidden" name="formId" value={form.id} />
											<button
												type="submit"
												class="text-gray-600 hover:text-gray-900"
											>
												{t("admin.forms.duplicate")}
											</button>
										</Form>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</AdminTable>
			)}
		</div>
	);
});

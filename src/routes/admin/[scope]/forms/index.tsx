import { component$ } from "@qwik.dev/core";
import {
	Form,
	Link,
	routeAction$,
	routeLoader$,
	z,
	zod$,
} from "@qwik.dev/router";
import { format } from "date-fns";
import { AdminTable } from "~/components/ui/AdminTable";
import { Button } from "~/components/ui/Button";
import { formResultsService } from "~/core/forms/form-results.service";
import { buildFormPath } from "~/core/forms/forms";
import { formsService } from "~/core/forms/forms.service";
import { isSurveyForm } from "~/core/forms/purposes";
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
		basePath: buildFormsAdminBasePath(event.params.scope),
	});
});

/** An editable copy of a form of this scope (how a locked form's questions are changed). */
export const useDuplicateForm = routeAction$(
	async (data, event) => {
		const { scope, userId } = await resolveFormsAdminScope(event);
		const form = await getOwnForm(scope, data.formId);
		if (!form) return event.fail(404, { message: "Form not found" });
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

	return (
		<div>
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-2xl font-bold">Manage Forms</h2>
				<Button href={`${data.value.basePath}/new`}>Create New Form</Button>
			</div>

			{data.value.forms.length === 0 ? (
				<div class="bg-white shadow-sm rounded-lg p-8 text-center">
					<p class="text-gray-500">No forms created yet.</p>
				</div>
			) : (
				<AdminTable>
					<thead class="bg-gray-50">
						<tr>
							<th class={th}>Title</th>
							<th class={th}>Purpose</th>
							<th class={th}>Visibility</th>
							<th class={th}>Updated</th>
							<th class={th}>Responses</th>
							<th class={th}>Actions</th>
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
											title="This form has answers: its questions can no longer be edited"
										>
											(locked)
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
									{format(new Date(form.updatedAt), "MMM d, yyyy")}
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
												Open
											</Link>
										)}
										<Link
											href={`${data.value.basePath}/${form.id}/responses`}
											class="text-purple-600 hover:text-purple-900"
										>
											Responses
										</Link>
										<Link
											href={`${data.value.basePath}/${form.id}/edit`}
											class="text-green-600 hover:text-green-900"
										>
											Edit
										</Link>
										<Form action={duplicate}>
											<input type="hidden" name="formId" value={form.id} />
											<button
												type="submit"
												class="text-gray-600 hover:text-gray-900"
											>
												Duplicate
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

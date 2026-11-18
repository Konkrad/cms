import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { formResultsService } from "~/core/forms/form-results.service";
import { formatDate, t } from "~/core/i18n";
import {
	buildFormsAdminBasePath,
	getOwnForm,
	resolveFormsAdminScope,
} from "../../_utils";
import { buildResponseColumns, getAnswerValue } from "./_response-pivot";

export const useResponses = routeLoader$(async (event) => {
	const { scope } = await resolveFormsAdminScope(event);
	const basePath = buildFormsAdminBasePath(event.params.scope);

	const form = await getOwnForm(scope, event.params.id);
	if (!form) {
		throw event.redirect(302, basePath);
	}

	const responses = await formResultsService.getByForm(form.id);
	const questionColumns = buildResponseColumns(form.schema, responses as any);

	return {
		form,
		responses,
		questionColumns,
		basePath,
		csvPath: `${basePath}/${form.id}/responses/export.csv`,
	};
});

export default component$(() => {
	const data = useResponses();

	return (
		<div>
			<div class="flex justify-between items-center mb-6">
				<div>
					<h2 class="text-2xl font-bold">
						{t("admin.forms.responses.responses")}
					</h2>
					<p class="text-gray-600">{data.value.form.title}</p>
				</div>
				<div class="flex gap-3">
					<a
						href={data.value.csvPath}
						target="_blank"
						rel="noreferrer"
						class="px-4 py-2 rounded-lg font-medium transition-colors bg-gray-200 hover:bg-gray-300 text-gray-800"
					>
						{t("admin.forms.responses.exportCsv")}
					</a>
					<Button
						href={`${data.value.basePath}/${data.value.form.id}/edit`}
						variant="secondary"
					>
						{t("admin.forms.responses.backToForm")}
					</Button>
				</div>
			</div>

			<Card>
				{data.value.responses.length === 0 ? (
					<p class="text-gray-500">
						{t("admin.forms.responses.noResponsesYet")}
					</p>
				) : (
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										{t("admin.forms.responses.submitted")}
									</th>
									{data.value.questionColumns.map((column) => (
										<th
											key={column.key}
											class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
											{column.label}
										</th>
									))}
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{data.value.responses.map((response) => (
									<tr key={response.id}>
										<td class="px-6 py-4 text-sm text-gray-700">
											{formatDate(response.createdAt, "dateTime")}
										</td>
										{data.value.questionColumns.map((column) => (
											<td
												key={column.key}
												class="px-6 py-4 text-sm text-gray-700 align-top"
											>
												{getAnswerValue(
													response.answers as Record<string, any>,
													column.key,
												) || "-"}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>
		</div>
	);
});

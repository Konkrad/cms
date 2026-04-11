import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { format } from "date-fns";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { formResultsService } from "~/services/form-results.service";
import { formsService } from "~/services/forms.service";
import { buildFormsAdminBasePath, resolveFormsAdminScope } from "../../_utils";
import { buildResponseColumns, getAnswerValue } from "./_response-pivot";

export const useResponses = routeLoader$(async (event) => {
  const scope = await resolveFormsAdminScope(event);
  const basePath = buildFormsAdminBasePath(event.params.group_slug);

  const form = await formsService.getByIdAndScope(event.params.id, scope.scopeType, scope.scopeId);
  if (!form) {
    throw event.redirect(302, basePath);
  }

  const responses = await formResultsService.getByForm(form.id);
  const questionColumns = buildResponseColumns(form.schemaJson as Record<string, any>, responses as any);

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
          <h2 class="text-2xl font-bold">Responses</h2>
          <p class="text-gray-600">{data.value.form.title}</p>
        </div>
        <div class="flex gap-3">
          <a
            href={data.value.csvPath}
            target="_blank"
            rel="noreferrer"
            class="px-4 py-2 rounded-lg font-medium transition-colors bg-gray-200 hover:bg-gray-300 text-gray-800"
          >
            Export CSV
          </a>
          <Button href={`${data.value.basePath}/${data.value.form.id}/edit`} variant="secondary">Back to Form</Button>
        </div>
      </div>

      <Card>
        {data.value.responses.length === 0 ? (
          <p class="text-gray-500">No responses yet.</p>
        ) : (
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
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
                      {format(new Date(response.submittedAt), "MMM d, yyyy HH:mm")}
                    </td>
                    {data.value.questionColumns.map((column) => (
                      <td key={column.key} class="px-6 py-4 text-sm text-gray-700 align-top">
                        {getAnswerValue(response.resultJson as Record<string, any>, column.key) || "-"}
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

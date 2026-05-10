import { component$ } from "@qwik.dev/core";
import { Link, routeLoader$ } from "@qwik.dev/router";
import { format } from "date-fns";
import { AdminTable } from "~/components/ui/AdminTable";
import { Button } from "~/components/ui/Button";
import { formResultsService } from "~/services/form-results.service";
import { formsService } from "~/services/forms.service";
import { buildFormPath } from "~/utils/forms";
import { buildFormsAdminBasePath, resolveFormsAdminScope } from "./_utils";

export const useFormsData = routeLoader$(async (event) => {
  const scope = await resolveFormsAdminScope(event);
  const forms = await formsService.listByScope(scope.scopeType, scope.scopeId);
  const responseCounts = await formResultsService.getCountsByFormIds(forms.map((form) => form.id));

  return {
    forms,
    responseCounts,
    basePath: buildFormsAdminBasePath(event.params.group_slug),
  };
});

export default component$(() => {
  const data = useFormsData();

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Manage Forms</h2>
        <Button href={`${data.value.basePath}/new`}>Create New Form</Button>
      </div>

      {data.value.forms.length === 0 ? (
        <div class="bg-white shadow rounded-lg p-8 text-center">
          <p class="text-gray-500">No forms created yet.</p>
        </div>
      ) : (
        <AdminTable>
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Slug
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visibility
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    System
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Responses
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {data.value.forms.map((form) => (
                  <tr key={form.id}>
                    <td class="px-6 py-4 font-medium">{form.title}</td>
                    <td class="px-6 py-4">
                      <code class="text-sm bg-gray-100 px-2 py-1 rounded">{form.slug}</code>
                    </td>
                    <td class="px-6 py-4 capitalize">{form.visibility}</td>
                    <td class="px-6 py-4">{form.isSystemForm ? form.systemKey || "yes" : "-"}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {format(new Date(form.updatedAt), "MMM d, yyyy")}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-700">{data.value.responseCounts[form.id] || 0}</td>
                    <td class="px-6 py-4 text-sm">
                      <div class="flex gap-3">
                        <Link href={buildFormPath(form)} class="text-blue-600 hover:text-blue-900">
                          Open
                        </Link>
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

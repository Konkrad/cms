import { component$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, z, zod$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { pagesService } from '~/services/pages.service';
import { format } from 'date-fns';
import { requireAdmin } from '~/utils/server-auth';

export const useAdminAuth = routeLoader$(async (event) => {
  await requireAdmin(event);
  return true;
});

export const usePages = routeLoader$(async () => {
  return await pagesService.getAll();
});

export const useDeletePage = routeAction$(
  async (data, event) => {
    await requireAdmin(event);

    const accessToken = event.cookie.get('sb-access-token')?.value;
    const refreshToken = event.cookie.get('sb-refresh-token')?.value;

    try {
      await pagesService.delete(data.pageId, accessToken, refreshToken);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to delete page',
      };
    }
  },
  zod$({
    pageId: z.string(),
  })
);

export default component$(() => {
  const pages = usePages();
  const deletePageAction = useDeletePage();

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Manage Pages</h2>
        <a href="/admin/pages/new">
          <Button variant="primary">Create New Page</Button>
        </a>
      </div>

      {deletePageAction.value?.success && (
        <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          Page deleted successfully
        </div>
      )}

      {deletePageAction.value?.error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {deletePageAction.value.error}
        </div>
      )}

      <Card>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parent
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {pages.value.map((page) => (
                <tr key={page.id}>
                  <td class="px-6 py-4">
                    <div class="max-w-xs truncate font-medium">{page.title}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <code class="text-sm bg-gray-100 px-2 py-1 rounded">/{page.slug}</code>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {page.parent?.title || '-'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class={`px-2 py-1 text-xs font-medium rounded-full ${
                        page.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {page.status}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(page.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <div class="flex gap-2">
                      {page.status === 'published' && (
                        <a href={`/${page.slug}`} class="text-blue-600 hover:text-blue-900">
                          View
                        </a>
                      )}
                      <a
                        href={`/admin/pages/${page.id}/edit`}
                        class="text-green-600 hover:text-green-900"
                      >
                        Edit Info
                      </a>
                      <a
                        href={`/admin/pages/${page.id}/builder`}
                        class="text-purple-600 hover:text-purple-900"
                      >
                        Builder
                      </a>
                      <Form action={deletePageAction} class="inline">
                        <input type="hidden" name="pageId" value={page.id} />
                        <button
                          type="submit"
                          class="text-red-600 hover:text-red-900"
                          onClick$={(e) => {
                            if (!confirm('Are you sure you want to delete this page?')) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Delete
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
});

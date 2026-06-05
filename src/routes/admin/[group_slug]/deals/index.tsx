import { component$ } from "@qwik.dev/core";
import { Form, Link, routeAction$, routeLoader$, zod$, z } from "@qwik.dev/router";
import { format } from "date-fns";
import { Button } from "~/components/ui/Button";
import { dealsService } from "~/services/deals.service";

export const useDeals = routeLoader$(async (event) => {
  if (event.params.group_slug !== "global") {
    throw event.redirect(302, "/admin/global/deals");
  }
  const deals = await dealsService.getAll();
  return { deals };
});

export const useDeleteDeal = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await dealsService.delete(data.dealId);
    return { success: true };
  },
  zod$({ dealId: z.string().uuid() }),
);

export default component$(() => {
  const data = useDeals();
  const deleteAction = useDeleteDeal();
  const now = new Date();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Deals</h2>
        <Button href="/admin/global/deals/new">Add Deal</Button>
      </div>

      <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Steps
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valid Until
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {data.value.deals.map((deal) => {
              const isExpired =
                deal.validUntil != null && new Date(deal.validUntil) < now;
              return (
                <tr key={deal.id} class="hover:bg-gray-50">
                  <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">
                      {deal.name}
                    </div>
                    {deal.description && (
                      <div class="text-sm text-gray-500 line-clamp-1">
                        {deal.description}
                      </div>
                    )}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {(deal.steps ?? []).length} step
                    {(deal.steps ?? []).length !== 1 ? "s" : ""}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    {deal.validUntil ? (
                      <span
                        class={
                          isExpired
                            ? "text-red-600 font-medium"
                            : "text-gray-700"
                        }
                      >
                        {isExpired ? "Expired · " : ""}
                        {format(new Date(deal.validUntil), "MMM d, yyyy")}
                      </span>
                    ) : (
                      <span class="text-gray-400">No expiry</span>
                    )}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex items-center gap-4">
                      <Link
                        href={`/admin/global/deals/${deal.id}/edit`}
                        class="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </Link>
                      <Form action={deleteAction}>
                        <input type="hidden" name="dealId" value={deal.id} />
                        <button
                          type="submit"
                          preventdefault:click
                          class="text-red-600 hover:text-red-900"
                          onClick$={(e) => {
                            if (!confirm("Delete this deal?")) return;
                            (e.target as HTMLElement).closest("form")?.requestSubmit();
                          }}
                        >
                          Delete
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.value.deals.length === 0 && (
          <div class="text-center py-12 text-gray-500">
            No deals yet. Add your first deal!
          </div>
        )}
      </div>
    </div>
  );
});

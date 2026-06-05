import { component$ } from "@qwik.dev/core";
import { Form, Link, routeAction$, routeLoader$, zod$, z } from "@qwik.dev/router";
import { qualificationsService } from "~/services/qualifications.service";

export const useQualificationsPage = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  const user = await requireAuth(event);

  const [types, myQualifications] = await Promise.all([
    qualificationsService.getTypes(),
    qualificationsService.getByUser(user.id),
  ]);

  const myQualByTypeId = Object.fromEntries(
    myQualifications.map((q) => [q.typeId, q]),
  );

  return { types, myQualByTypeId };
});

export const useApply = routeAction$(
  async (data, event) => {
    const { requireAuth } = await import("~/utils/server-auth");
    const user = await requireAuth(event);
    await qualificationsService.upsert(user.id, data.typeId);
    return { success: true };
  },
  zod$({ typeId: z.string().uuid() }),
);

export default component$(() => {
  const data = useQualificationsPage();
  const applyAction = useApply();

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      pending:  { cls: "bg-yellow-100 text-yellow-800", label: "Pending review" },
      approved: { cls: "bg-green-100 text-green-800",  label: "Verified" },
      rejected: { cls: "bg-red-100 text-red-800",     label: "Not approved" },
    };
    return map[status] ?? { cls: "bg-gray-100 text-gray-700", label: status };
  };

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-2">
        <h1 class="text-3xl font-bold text-gray-900">Qualifications</h1>
        <Link href="/profile" class="text-sm text-blue-600 hover:text-blue-800">
          My profile →
        </Link>
      </div>
      <p class="text-gray-600 mb-8">
        Apply for a qualification to have it verified by an admin. Approved qualifications
        are shown on your profile and may grant you a higher membership tier.
      </p>

      <div class="space-y-4">
        {data.value.types.map((t) => {
          const existing = data.value.myQualByTypeId[t.id];
          const badge = existing ? statusBadge(existing.status) : null;

          return (
            <div
              key={t.id}
              class="bg-white rounded-lg border border-gray-200 p-5 flex items-start justify-between gap-4"
            >
              <div class="flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="text-base font-semibold text-gray-900">{t.label}</h2>
                  {badge && (
                    <span class={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                {t.description && (
                  <p class="text-sm text-gray-500 mt-1">{t.description}</p>
                )}
                <p class="text-xs text-gray-400 mt-1 capitalize">
                  Grants: {t.grantsMembershipTier} membership
                </p>
                {existing?.status === "rejected" && existing.notes && (
                  <p class="text-xs text-red-600 mt-2 bg-red-50 border border-red-100 rounded px-2 py-1">
                    Feedback: {existing.notes}
                  </p>
                )}
              </div>

              <div class="shrink-0">
                {!existing && (
                  <Form action={applyAction}>
                    <input type="hidden" name="typeId" value={t.id} />
                    <button
                      type="submit"
                      class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
                    >
                      Apply
                    </button>
                  </Form>
                )}
                {existing?.status === "pending" && (
                  <span class="text-sm text-gray-400">Awaiting review</span>
                )}
                {existing?.status === "approved" && (
                  <span class="text-sm text-green-600">✓ Verified</span>
                )}
                {existing?.status === "rejected" && (
                  <Form action={applyAction}>
                    <input type="hidden" name="typeId" value={t.id} />
                    <button
                      type="submit"
                      class="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 whitespace-nowrap"
                      onClick$={(e) => {
                        if (!confirm("Re-submit this qualification for review?")) e.preventDefault();
                      }}
                    >
                      Re-apply
                    </button>
                  </Form>
                )}
              </div>
            </div>
          );
        })}

        {data.value.types.length === 0 && (
          <div class="text-center py-16 text-gray-500">
            No qualification types have been set up yet.
          </div>
        )}
      </div>
    </div>
  );
});

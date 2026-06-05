import { component$, useSignal } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, zod$, z } from "@qwik.dev/router";
import QRCode from "qrcode";
import { qualificationsService } from "~/services/qualifications.service";

export const useQualificationsData = routeLoader$(async (event) => {
  if (event.params.group_slug !== "global") {
    throw event.redirect(302, "/admin/global/qualifications");
  }
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);
  const [types, pending, all] = await Promise.all([
    qualificationsService.getTypes(),
    qualificationsService.getPendingApplications(),
    qualificationsService.getAllApplications(),
  ]);

  // Load active tokens for each type and generate QR data URIs
  const baseUrl = event.url.origin;
  const tokensWithQr = await Promise.all(
    types.map(async (t) => {
      const tokens = await qualificationsService.getActiveTokensForType(t.id);
      const now = new Date().toISOString();
      const activeTokens = tokens.filter((tok) => tok.expiresAt > now);
      const withQr = await Promise.all(
        activeTokens.map(async (tok) => ({
          ...tok,
          qrDataUrl: await QRCode.toDataURL(
            `${baseUrl}/qualifications/verify/${tok.token}`,
            { width: 280, margin: 2, errorCorrectionLevel: "H" },
          ),
          verifyUrl: `${baseUrl}/qualifications/verify/${tok.token}`,
        })),
      );
      return { typeId: t.id, tokens: withQr };
    }),
  );

  const tokensByType = Object.fromEntries(
    tokensWithQr.map((t) => [t.typeId, t.tokens]),
  );

  return { types, pending, all, tokensByType };
});

export const useCreateType = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await qualificationsService.createType(data as any);
    return { success: true };
  },
  zod$({
    slug: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
    grantsMembershipTier: z.enum(["associated", "full"]),
  }),
);

export const useDeleteType = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await qualificationsService.deleteType(data.typeId);
    return { success: true };
  },
  zod$({ typeId: z.string().uuid() }),
);

export const useApproveQualification = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    const user = await requireAdmin(event);
    await qualificationsService.approve(data.qualId, user.id, data.notes || undefined);
    return { success: true };
  },
  zod$({ qualId: z.string().uuid(), notes: z.string().optional() }),
);

export const useRejectQualification = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    const user = await requireAdmin(event);
    await qualificationsService.reject(data.qualId, user.id, data.notes);
    return { success: true };
  },
  zod$({ qualId: z.string().uuid(), notes: z.string().min(1, "Please provide a reason") }),
);

export const useGenerateToken = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    const user = await requireAdmin(event);
    await qualificationsService.createToken(data.typeId, user.id, data.expiresInHours);
    return { success: true };
  },
  zod$({
    typeId: z.string().uuid(),
    expiresInHours: z.coerce.number().int().min(1).max(72),
  }),
);

export const useRevokeToken = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await qualificationsService.revokeToken(data.tokenId);
    return { success: true };
  },
  zod$({ tokenId: z.string().uuid() }),
);

export default component$(() => {
  const data = useQualificationsData();
  const createTypeAction = useCreateType();
  const deleteTypeAction = useDeleteType();
  const approveAction = useApproveQualification();
  const rejectAction = useRejectQualification();
  const generateTokenAction = useGenerateToken();
  const revokeTokenAction = useRevokeToken();
  const activeTab = useSignal<"pending" | "all" | "types">("pending");

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-800"}`;
  };

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Qualifications</h2>
      </div>

      <div class="flex gap-2 mb-6 border-b">
        {(["pending", "all", "types"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            class={[
              "px-4 py-2 text-sm font-medium -mb-px border-b-2",
              activeTab.value === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700",
            ].join(" ")}
            onClick$={() => (activeTab.value = tab)}
          >
            {tab === "pending"
              ? `Pending (${data.value.pending.length})`
              : tab === "all"
                ? "All Applications"
                : "Types"}
          </button>
        ))}
      </div>

      {activeTab.value === "pending" && (
        <div class="bg-white rounded-lg shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {data.value.pending.map((q) => (
                <tr key={q.id} class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-900">
                    {(q as any).user?.name} {(q as any).user?.familyName}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-700">{q.type.label}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">{q.createdAt.slice(0, 10)}</td>
                  <td class="px-6 py-4">
                    <div class="flex flex-col gap-2">
                      <Form action={approveAction} class="flex items-center gap-2">
                        <input type="hidden" name="qualId" value={q.id} />
                        <input type="text" name="notes" placeholder="Optional note" class="text-xs border rounded px-2 py-1 w-40" />
                        <button type="submit" class="text-green-600 hover:text-green-900 text-sm font-medium">Approve</button>
                      </Form>
                      <Form action={rejectAction} class="flex items-center gap-2">
                        <input type="hidden" name="qualId" value={q.id} />
                        <input type="text" name="notes" placeholder="Reason (required)" class="text-xs border rounded px-2 py-1 w-40" required />
                        <button type="submit" class="text-red-600 hover:text-red-900 text-sm font-medium">Reject</button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.value.pending.length === 0 && (
            <div class="text-center py-12 text-gray-500">No pending qualifications.</div>
          )}
        </div>
      )}

      {activeTab.value === "all" && (
        <div class="bg-white rounded-lg shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {data.value.all.map((q) => (
                <tr key={q.id} class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-900">
                    {(q as any).user?.name} {(q as any).user?.familyName}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-700">{q.type.label}</td>
                  <td class="px-6 py-4"><span class={statusBadge(q.status)}>{q.status}</span></td>
                  <td class="px-6 py-4 text-sm text-gray-500">{q.notes ?? "—"}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">{q.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.value.all.length === 0 && (
            <div class="text-center py-12 text-gray-500">No qualification applications yet.</div>
          )}
        </div>
      )}

      {activeTab.value === "types" && (
        <div class="space-y-8">
          {/* Types list with per-type QR token section */}
          {data.value.types.map((t) => {
            const activeTokens = data.value.tokensByType[t.id] ?? [];
            return (
              <div key={t.id} class="bg-white rounded-lg shadow-sm overflow-hidden">
                <div class="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
                  <div>
                    <span class="font-medium text-gray-900">{t.label}</span>
                    <span class="ml-2 text-xs text-gray-500 font-mono">{t.slug}</span>
                    <span class="ml-3 text-xs text-gray-600 capitalize">→ {t.grantsMembershipTier} member</span>
                  </div>
                  <Form action={deleteTypeAction} class="inline">
                    <input type="hidden" name="typeId" value={t.id} />
                    <button
                      type="submit"
                      class="text-xs text-red-500 hover:text-red-700"
                      preventdefault:click
                      onClick$={(e) => {
                        if (!confirm(`Delete type "${t.label}"?`)) return;
                        (e.target as HTMLElement).closest("form")?.requestSubmit();
                      }}
                    >
                      Delete type
                    </button>
                  </Form>
                </div>

                <div class="px-6 py-5">
                  <div class="flex items-start gap-8 flex-wrap">
                    {/* Generate new token */}
                    <div class="shrink-0">
                      <h4 class="text-sm font-medium text-gray-700 mb-2">Generate verification QR</h4>
                      <Form action={generateTokenAction} class="flex items-center gap-2">
                        <input type="hidden" name="typeId" value={t.id} />
                        <div class="flex items-center gap-1">
                          <input
                            type="number"
                            name="expiresInHours"
                            value={4}
                            min={1}
                            max={72}
                            class="w-16 text-sm border rounded px-2 py-1 text-center"
                          />
                          <span class="text-sm text-gray-500">hours</span>
                        </div>
                        <button
                          type="submit"
                          class="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                        >
                          Generate
                        </button>
                      </Form>
                      <p class="text-xs text-gray-400 mt-1">
                        Members who scan the QR code will be automatically verified.
                      </p>
                    </div>

                    {/* Active tokens / QR codes */}
                    {activeTokens.length > 0 && (
                      <div class="flex gap-6 flex-wrap">
                        {activeTokens.map((tok) => (
                          <div key={tok.id} class="border border-gray-200 rounded-lg p-4 text-center bg-white shadow-sm">
                            <img
                              src={tok.qrDataUrl}
                              alt="Verification QR code"
                              width={140}
                              height={140}
                              class="mx-auto block"
                            />
                            <div class="mt-2 text-xs text-gray-500">
                              Expires {new Date(tok.expiresAt).toLocaleString()}
                            </div>
                            <a
                              href={tok.verifyUrl}
                              target="_blank"
                              class="block mt-1 text-xs text-blue-500 hover:underline truncate max-w-[160px] mx-auto"
                            >
                              {tok.verifyUrl.replace(/^https?:\/\//, "").slice(0, 40)}…
                            </a>
                            <Form action={revokeTokenAction} class="mt-2">
                              <input type="hidden" name="tokenId" value={tok.id} />
                              <button
                                type="submit"
                                class="text-xs text-red-500 hover:text-red-700"
                                preventdefault:click
                                onClick$={(e) => {
                                  if (!confirm("Deactivate this QR code?")) return;
                                  (e.target as HTMLElement).closest("form")?.requestSubmit();
                                }}
                              >
                                Deactivate
                              </button>
                            </Form>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTokens.length === 0 && (
                      <p class="text-sm text-gray-400 self-center">No active QR codes for this type.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {data.value.types.length === 0 && (
            <div class="text-center py-8 text-gray-500 bg-white rounded-lg shadow-sm">
              No qualification types yet.
            </div>
          )}

          {/* Add new type */}
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Add Qualification Type</h3>
            <Form action={createTypeAction} class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input type="text" name="label" required placeholder="e.g. Master School Graduate" class="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input type="text" name="slug" required placeholder="e.g. master-school" class="w-full border rounded-md px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Grants Membership Tier</label>
                <select name="grantsMembershipTier" class="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="associated">Associated</option>
                  <option value="full">Full</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input type="text" name="description" placeholder="Shown on user profile" class="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div class="col-span-2">
                <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
                  Add Type
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
});

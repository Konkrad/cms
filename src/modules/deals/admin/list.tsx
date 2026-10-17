import { component$ } from "@qwik.dev/core";
import { Form, Link, routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireModuleAdmin, requireWithinScope } from "~/core";
import { Button, formatDate, Pagination, SearchBar, t } from "~/core/ui";
import { dealsService } from "../service";
import type { AdminDealsData } from "./list-data";

export const useDeleteDeal = routeAction$(
	async (data, event) => {
		const { scope } = await requireModuleAdmin(event, { module: "deals" });
		await requireWithinScope(
			event,
			scope,
			await dealsService.getById(data.dealId),
		);
		await dealsService.delete(data.dealId);
		return { success: true };
	},
	zod$({ dealId: z.string().uuid() }),
);

export const AdminDealsList = component$<{ data: AdminDealsData }>(
	({ data }) => {
		const deleteAction = useDeleteDeal();
		const now = new Date();
		const totalPages = Math.ceil(data.total / data.pageSize);

		return (
			<div>
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-2xl font-bold text-gray-800">
						{t("deals.admin.list.deals")}
					</h2>
					<Button href={`${data.adminBase}/deals/new`}>
						{t("deals.admin.list.addDeal")}
					</Button>
				</div>

				<SearchBar
					value={data.search}
					placeholder={t("deals.admin.list.searchByName")}
				/>

				<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("deals.admin.list.name")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("deals.admin.list.steps")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("deals.admin.list.validUntil")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("deals.admin.list.actions")}
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{data.deals.map((deal) => {
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
											{t("deals.admin.list.step", {
												count: (deal.steps ?? []).length,
											})}
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
													{isExpired ? t("deals.admin.list.expired") : ""}
													{formatDate(deal.validUntil)}
												</span>
											) : (
												<span class="text-gray-400">
													{t("deals.admin.list.noExpiry")}
												</span>
											)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
											<div class="flex items-center gap-4">
												<Link
													href={`${data.adminBase}/deals/${deal.id}/edit`}
													class="text-blue-600 hover:text-blue-900"
												>
													{t("deals.admin.list.edit")}
												</Link>
												<Form action={deleteAction}>
													<input type="hidden" name="dealId" value={deal.id} />
													<button
														type="submit"
														preventdefault:click
														class="text-red-600 hover:text-red-900"
														onClick$={(e) => {
															if (
																!confirm(t("deals.admin.list.deleteThisDeal"))
															)
																return;
															(e.target as HTMLElement)
																.closest("form")
																?.requestSubmit();
														}}
													>
														{t("deals.admin.list.delete")}
													</button>
												</Form>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					{data.deals.length === 0 && (
						<div class="text-center py-12 text-gray-500">
							{data.search
								? t("deals.admin.list.noDealsMatching", { search: data.search })
								: t("deals.admin.list.noDealsYetAddYour")}
						</div>
					)}
					<Pagination
						page={data.page}
						totalPages={totalPages}
						total={data.total}
						pageSize={data.pageSize}
					/>
				</div>
			</div>
		);
	},
);

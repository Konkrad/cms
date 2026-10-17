import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { Pagination, SearchBar, t } from "~/core/ui";
import type { AdminElectionsData } from "./data";

const statusBadge = (status: string) => {
	const map: Record<string, string> = {
		draft: "bg-gray-100 text-gray-700",
		open: "bg-green-100 text-green-800",
		closed: "bg-slate-100 text-slate-700",
	};
	return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? "bg-gray-100 text-gray-800"}`;
};

export const AdminElectionsList = component$<{ data: AdminElectionsData }>(
	({ data: loaded }) => {
		const data = { value: loaded };
		const totalPages = Math.ceil(data.value.total / data.value.pageSize);

		return (
			<div>
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-2xl font-bold text-gray-800">
						{t("elections.admin.list.elections")}
					</h2>
					<Link
						href={`${loaded.adminBase}/elections/new`}
						class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
					>
						{t("elections.admin.list.newElectionCycle")}
					</Link>
				</div>

				<SearchBar
					value={data.value.search}
					placeholder={t("elections.admin.list.searchByTitle")}
				/>

				<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("elections.admin.list.title")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("elections.admin.list.year")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("elections.admin.list.status")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("elections.admin.list.requiredTier")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("elections.admin.list.actions")}
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{data.value.cycles.map((cycle) => (
								<tr key={cycle.id} class="hover:bg-gray-50">
									<td class="px-6 py-4 text-sm font-medium text-gray-900">
										{cycle.title}
									</td>
									<td class="px-6 py-4 text-sm text-gray-700">{cycle.year}</td>
									<td class="px-6 py-4">
										<span class={statusBadge(cycle.status)}>
											{cycle.status}
										</span>
									</td>
									<td class="px-6 py-4 text-sm text-gray-500 capitalize">
										{cycle.requiredMembershipTier ??
											t("elections.admin.list.none")}
									</td>
									<td class="px-6 py-4 text-sm">
										<Link
											href={`${loaded.adminBase}/elections/${cycle.id}`}
											class="text-blue-600 hover:text-blue-900"
										>
											{t("elections.admin.list.manage")}
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{data.value.cycles.length === 0 && (
						<div class="text-center py-12 text-gray-500">
							{data.value.search
								? t("elections.admin.list.noElectionsMatching", {
										search: data.value.search,
									})
								: t("elections.admin.list.noElectionCyclesYet")}
						</div>
					)}
					<Pagination
						page={data.value.page}
						totalPages={totalPages}
						total={data.value.total}
						pageSize={data.value.pageSize}
					/>
				</div>
			</div>
		);
	},
);

import { component$, useSignal } from "@qwik.dev/core";
import { Form, Link } from "@qwik.dev/router";
import { t } from "~/core/ui";
import {
	useAdvanceStatus,
	useApproveApplication,
	useDeletePosition,
	useRejectApplication,
	useSetVotingUrl,
} from "./actions";
import type { AdminCycleData } from "./data";

const STATUS_NEXT: Record<string, string | null> = {
	draft: "open",
	open: "voting",
	voting: "closed",
	closed: null,
};

const STATUS_NEXT_LABEL: Record<string, string> = {
	draft: t("elections.admin.cycle.openForApplications"),
	open: t("elections.admin.cycle.closeApplicationsStartVoting"),
	voting: t("elections.admin.cycle.closeElection"),
};

const statusBadge = (status: string) => {
	const map: Record<string, string> = {
		draft: "bg-gray-100 text-gray-700",
		open: "bg-green-100 text-green-800",
		voting: "bg-blue-100 text-blue-800",
		closed: "bg-slate-100 text-slate-700",
		pending: "bg-yellow-100 text-yellow-800",
		approved: "bg-green-100 text-green-800",
		rejected: "bg-red-100 text-red-800",
	};
	return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? "bg-gray-100 text-gray-800"}`;
};

export const AdminElectionCycle = component$<{ data: AdminCycleData }>(
	({ data: loaded }) => {
		const data = { value: loaded };
		const advanceAction = useAdvanceStatus();
		const setVotingUrlAction = useSetVotingUrl();
		const deletePosAction = useDeletePosition();
		const approveAppAction = useApproveApplication();
		const rejectAppAction = useRejectApplication();
		const activeTab = useSignal<"positions" | "applications">("applications");

		const { cycle, applications } = data.value;
		const nextStatus = STATUS_NEXT[cycle.status];

		const appsByPosition = cycle.positions.map((pos) => ({
			position: pos,
			apps: applications.filter((a) => a.positionId === pos.id),
		}));

		return (
			<div>
				<div class="flex items-center justify-between mb-2">
					<div>
						<Link
							href={`${data.value.adminBase}/elections`}
							class="text-sm text-gray-500 hover:text-gray-700"
						>
							{t("elections.admin.cycle.elections")}
						</Link>
						<h2 class="text-2xl font-bold text-gray-800 mt-1">{cycle.title}</h2>
					</div>
					<div class="flex items-center gap-3">
						<span class={statusBadge(cycle.status)}>{cycle.status}</span>
						{nextStatus && (
							<Form action={advanceAction}>
								<input type="hidden" name="cycleId" value={cycle.id} />
								<input type="hidden" name="status" value={nextStatus} />
								<button
									type="submit"
									class="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
									preventdefault:click
									onClick$={(e) => {
										if (
											!confirm(
												t("elections.admin.cycle.moveCycleTo", { nextStatus }),
											)
										)
											return;
										(e.target as HTMLElement).closest("form")?.requestSubmit();
									}}
								>
									{STATUS_NEXT_LABEL[cycle.status] ??
										t("elections.admin.cycle.setTo", { nextStatus })}
								</button>
							</Form>
						)}
					</div>
				</div>

				{advanceAction.value?.failed && (
					<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
						{(advanceAction.value as any).error}
					</div>
				)}

				{cycle.description && (
					<p class="text-gray-600 text-sm mb-4">{cycle.description}</p>
				)}

				{/* Voting URL — editable when cycle is in voting status */}
				{(cycle.status === "voting" || cycle.status === "closed") && (
					<div class="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg">
						<p class="text-sm font-medium text-blue-800 mb-2">
							{t("elections.admin.cycle.votingFormLink")}
						</p>
						<Form action={setVotingUrlAction} class="flex gap-2 items-center">
							<input type="hidden" name="cycleId" value={cycle.id} />
							<input
								type="url"
								name="votingUrl"
								value={(cycle as any).votingUrl ?? ""}
								placeholder={t(
									"elections.admin.cycle.httpsFormsExampleComVote",
								)}
								class="flex-1 border rounded px-3 py-1.5 text-sm"
							/>
							<button
								type="submit"
								class="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
							>
								{t("elections.admin.cycle.save")}
							</button>
						</Form>
						{(cycle as any).votingUrl && (
							<p class="text-xs text-blue-600 mt-1">
								{t("elections.admin.cycle.membersWillSeeAVote")}
							</p>
						)}
					</div>
				)}

				<div class="flex gap-2 mb-6 border-b">
					{(["applications", "positions"] as const).map((tab) => (
						<button
							key={tab}
							type="button"
							class={[
								"px-4 py-2 text-sm font-medium -mb-px border-b-2",
								activeTab.value === tab
									? "border-blue-600 text-blue-600"
									: "border-transparent text-gray-500 hover:text-gray-700",
							].join(" ")}
							onClick$={() => {
								activeTab.value = tab;
							}}
						>
							{tab === "applications"
								? t("elections.admin.cycle.applications", {
										count: applications.length,
									})
								: t("elections.admin.cycle.positions", {
										count: cycle.positions.length,
									})}
						</button>
					))}
				</div>

				{activeTab.value === "applications" && (
					<div class="space-y-6">
						{appsByPosition.map(({ position, apps }) => (
							<div
								key={position.id}
								class="bg-white rounded-lg shadow-sm overflow-x-auto"
							>
								<div class="px-6 py-3 bg-gray-50 border-b">
									<h3 class="font-medium text-gray-900">{position.title}</h3>
								</div>
								{apps.length === 0 ? (
									<div class="px-6 py-4 text-sm text-gray-500">
										{t("elections.admin.cycle.noApplicationsYet")}
									</div>
								) : (
									<table class="min-w-full divide-y divide-gray-200">
										<thead>
											<tr>
												<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													{t("elections.admin.cycle.applicant")}
												</th>
												<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													{t("elections.admin.cycle.status")}
												</th>
												<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													{t("elections.admin.cycle.note")}
												</th>
												<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													{t("elections.admin.cycle.actions")}
												</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-gray-200">
											{apps.map((app) => (
												<tr key={app.id} class="hover:bg-gray-50 align-top">
													<td class="px-6 py-4 text-sm text-gray-900">
														{app.user.name} {app.user.familyName}
														<div class="text-xs text-gray-400 mt-1">
															{app.createdAt.slice(0, 10)}
														</div>
													</td>
													<td class="px-6 py-4">
														<span class={statusBadge(app.status)}>
															{app.status}
														</span>
													</td>
													<td class="px-6 py-4 text-sm text-gray-500">
														{app.adminNote ?? "—"}
													</td>
													<td class="px-6 py-4">
														<div class="flex flex-col gap-2">
															<Form
																action={approveAppAction}
																class="flex items-center gap-2"
															>
																<input
																	type="hidden"
																	name="appId"
																	value={app.id}
																/>
																<input
																	type="text"
																	name="notes"
																	placeholder={t(
																		"elections.admin.cycle.optionalNote",
																	)}
																	class="text-xs border rounded px-2 py-1 w-32"
																/>
																<button
																	type="submit"
																	class="text-green-600 hover:text-green-900 text-xs font-medium"
																>
																	{t("elections.admin.cycle.approve")}
																</button>
															</Form>
															<Form
																action={rejectAppAction}
																class="flex items-center gap-2"
															>
																<input
																	type="hidden"
																	name="appId"
																	value={app.id}
																/>
																<input
																	type="text"
																	name="notes"
																	placeholder={t(
																		"elections.admin.cycle.optionalNote",
																	)}
																	class="text-xs border rounded px-2 py-1 w-32"
																/>
																<button
																	type="submit"
																	class="text-red-600 hover:text-red-900 text-xs font-medium"
																>
																	{t("elections.admin.cycle.reject")}
																</button>
															</Form>
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								)}
							</div>
						))}
						{cycle.positions.length === 0 && (
							<div class="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm">
								{t("elections.admin.cycle.addPositionsFirstToSee")}
							</div>
						)}
					</div>
				)}

				{activeTab.value === "positions" && (
					<div class="space-y-4">
						<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
											{t("elections.admin.cycle.position")}
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
											{t("elections.admin.cycle.description")}
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
											{t("elections.admin.cycle.max")}
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
											{t("elections.admin.cycle.actions")}
										</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{cycle.positions.map((pos) => (
										<tr key={pos.id} class="hover:bg-gray-50">
											<td class="px-6 py-4 text-sm font-medium text-gray-900">
												{pos.title}
											</td>
											<td class="px-6 py-4 text-sm text-gray-500">
												{pos.description ?? "—"}
											</td>
											<td class="px-6 py-4 text-sm text-gray-500">
												{pos.maxCandidates ?? "—"}
											</td>
											<td class="px-6 py-4">
												{cycle.status === "draft" && (
													<Form action={deletePosAction}>
														<input
															type="hidden"
															name="positionId"
															value={pos.id}
														/>
														<button
															type="submit"
															class="text-red-600 hover:text-red-900 text-sm"
															preventdefault:click
															onClick$={(e) => {
																if (
																	!confirm(
																		t("elections.admin.cycle.deletePosition", {
																			title: pos.title,
																		}),
																	)
																)
																	return;
																(e.target as HTMLElement)
																	.closest("form")
																	?.requestSubmit();
															}}
														>
															{t("elections.admin.cycle.delete")}
														</button>
													</Form>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							{cycle.positions.length === 0 && (
								<div class="text-center py-8 text-gray-500">
									{t("elections.admin.cycle.noPositionsYet")}
								</div>
							)}
						</div>

						{cycle.status === "draft" && (
							<Link
								href={`${data.value.adminBase}/elections/${cycle.id}/positions/new`}
								class="inline-block bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
							>
								{t("elections.admin.cycle.addPosition")}
							</Link>
						)}
						{cycle.status !== "draft" && (
							<p class="text-sm text-gray-500">
								{t("elections.admin.cycle.positionsCanOnlyBeAdded")}
							</p>
						)}
					</div>
				)}
			</div>
		);
	},
);

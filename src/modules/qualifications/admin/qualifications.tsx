import { component$, useSignal } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { formatDate, t } from "~/core/ui";
import {
	useApproveQualification,
	useCreateType,
	useDeleteType,
	useGenerateToken,
	useRejectQualification,
	useRevokeToken,
} from "./actions";
import type { AdminQualificationsData } from "./data";

export const AdminQualifications = component$<{
	data: AdminQualificationsData;
}>(({ data: loaded }) => {
	const data = { value: loaded };
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
				<h2 class="text-2xl font-bold text-gray-800">
					{t("qualifications.admin.qualifications.qualifications")}
				</h2>
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
						onClick$={() => {
							activeTab.value = tab;
						}}
					>
						{tab === "pending"
							? t("qualifications.admin.qualifications.pending", {
									count: data.value.pending.length,
								})
							: tab === "all"
								? t("qualifications.admin.qualifications.allApplications")
								: t("qualifications.admin.qualifications.types")}
					</button>
				))}
			</div>

			{activeTab.value === "pending" && (
				<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("qualifications.admin.qualifications.user")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("qualifications.admin.qualifications.type")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("qualifications.admin.qualifications.submitted")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("qualifications.admin.qualifications.actions")}
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{data.value.pending.map((q) => (
								<tr key={q.id} class="hover:bg-gray-50">
									<td class="px-6 py-4 text-sm text-gray-900">
										{(q as any).user?.name} {(q as any).user?.familyName}
									</td>
									<td class="px-6 py-4 text-sm text-gray-700">
										{q.type.label}
									</td>
									<td class="px-6 py-4 text-sm text-gray-500">
										{q.createdAt.slice(0, 10)}
									</td>
									<td class="px-6 py-4">
										<div class="flex flex-col gap-2">
											<Form
												action={approveAction}
												class="flex items-center gap-2"
											>
												<input type="hidden" name="qualId" value={q.id} />
												<input
													type="text"
													name="notes"
													placeholder={t(
														"qualifications.admin.qualifications.optionalNote",
													)}
													class="text-xs border rounded px-2 py-1 w-40"
												/>
												<button
													type="submit"
													class="text-green-600 hover:text-green-900 text-sm font-medium"
												>
													{t("qualifications.admin.qualifications.approve")}
												</button>
											</Form>
											<Form
												action={rejectAction}
												class="flex items-center gap-2"
											>
												<input type="hidden" name="qualId" value={q.id} />
												<input
													type="text"
													name="notes"
													placeholder={t(
														"qualifications.admin.qualifications.reasonRequired",
													)}
													class="text-xs border rounded px-2 py-1 w-40"
													required
												/>
												<button
													type="submit"
													class="text-red-600 hover:text-red-900 text-sm font-medium"
												>
													{t("qualifications.admin.qualifications.reject")}
												</button>
											</Form>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{data.value.pending.length === 0 && (
						<div class="text-center py-12 text-gray-500">
							{t("qualifications.admin.qualifications.noPendingQualifications")}
						</div>
					)}
				</div>
			)}

			{activeTab.value === "all" && (
				<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("qualifications.admin.qualifications.user")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("qualifications.admin.qualifications.type")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("qualifications.admin.qualifications.status")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("qualifications.admin.qualifications.notes")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									{t("qualifications.admin.qualifications.date")}
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{data.value.all.map((q) => (
								<tr key={q.id} class="hover:bg-gray-50">
									<td class="px-6 py-4 text-sm text-gray-900">
										{(q as any).user?.name} {(q as any).user?.familyName}
									</td>
									<td class="px-6 py-4 text-sm text-gray-700">
										{q.type.label}
									</td>
									<td class="px-6 py-4">
										<span class={statusBadge(q.status)}>{q.status}</span>
									</td>
									<td class="px-6 py-4 text-sm text-gray-500">
										{q.notes ?? "—"}
									</td>
									<td class="px-6 py-4 text-sm text-gray-500">
										{q.createdAt.slice(0, 10)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{data.value.all.length === 0 && (
						<div class="text-center py-12 text-gray-500">
							{t(
								"qualifications.admin.qualifications.noQualificationApplicationsYet",
							)}
						</div>
					)}
				</div>
			)}

			{activeTab.value === "types" && (
				<div class="space-y-8">
					{/* Types list with per-type QR token section */}
					{data.value.types.map((item) => {
						const activeTokens = data.value.tokensByType[item.id] ?? [];
						return (
							<div
								key={item.id}
								class="bg-white rounded-lg shadow-sm overflow-x-auto"
							>
								<div class="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
									<div>
										<span class="font-medium text-gray-900">{item.label}</span>
										<span class="ml-2 text-xs text-gray-500 font-mono">
											{item.slug}
										</span>
										<span class="ml-3 text-xs text-gray-600 capitalize">
											{item.grantsMembershipTier === "full"
												? t("qualifications.admin.qualifications.grantsFull")
												: t(
														"qualifications.admin.qualifications.grantsAssociated",
													)}
										</span>
									</div>
									<Form action={deleteTypeAction} class="inline">
										<input type="hidden" name="typeId" value={item.id} />
										<button
											type="submit"
											class="text-xs text-red-500 hover:text-red-700"
											preventdefault:click
											onClick$={(e) => {
												if (
													!confirm(
														t(
															"qualifications.admin.qualifications.confirmDeleteType",
															{ label: item.label },
														),
													)
												)
													return;
												(e.target as HTMLElement)
													.closest("form")
													?.requestSubmit();
											}}
										>
											{t("qualifications.admin.qualifications.deleteType")}
										</button>
									</Form>
								</div>

								<div class="px-6 py-5">
									<div class="flex items-start gap-8 flex-wrap">
										{/* Generate new token */}
										<div class="shrink-0">
											<h4 class="text-sm font-medium text-gray-700 mb-2">
												{t(
													"qualifications.admin.qualifications.generateVerificationQr",
												)}
											</h4>
											<Form
												action={generateTokenAction}
												class="flex items-center gap-2"
											>
												<input type="hidden" name="typeId" value={item.id} />
												<div class="flex items-center gap-1">
													<input
														type="number"
														name="expiresInHours"
														value={4}
														min={1}
														max={72}
														class="w-16 text-sm border rounded px-2 py-1 text-center"
													/>
													<span class="text-sm text-gray-500">
														{t("qualifications.admin.qualifications.hours")}
													</span>
												</div>
												<button
													type="submit"
													class="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
												>
													{t("qualifications.admin.qualifications.generate")}
												</button>
											</Form>
											<p class="text-xs text-gray-400 mt-1">
												{t(
													"qualifications.admin.qualifications.membersWhoScanTheQr",
												)}
											</p>
										</div>

										{/* Active tokens / QR codes */}
										{activeTokens.length > 0 && (
											<div class="flex gap-6 flex-wrap">
												{activeTokens.map((tok) => (
													<div
														key={tok.id}
														class="border border-gray-200 rounded-lg p-4 text-center bg-white shadow-sm"
													>
														<img
															src={tok.qrDataUrl}
															alt={t(
																"qualifications.admin.qualifications.verificationQrCode",
															)}
															width={140}
															height={140}
															class="mx-auto block"
														/>
														<div class="mt-2 text-xs text-gray-500">
															{t(
																"qualifications.admin.qualifications.expires",
																{
																	expiresAt: formatDate(
																		tok.expiresAt,
																		"dateTime",
																	),
																},
															)}
														</div>
														<a
															href={tok.verifyUrl}
															target="_blank"
															class="block mt-1 text-xs text-blue-500 hover:underline truncate max-w-[160px] mx-auto"
														>
															{tok.verifyUrl
																.replace(/^https?:\/\//, "")
																.slice(0, 40)}
															…
														</a>
														<Form action={revokeTokenAction} class="mt-2">
															<input
																type="hidden"
																name="tokenId"
																value={tok.id}
															/>
															<button
																type="submit"
																class="text-xs text-red-500 hover:text-red-700"
																preventdefault:click
																onClick$={(e) => {
																	if (
																		!confirm(
																			t(
																				"qualifications.admin.qualifications.deactivateThisQrCode",
																			),
																		)
																	)
																		return;
																	(e.target as HTMLElement)
																		.closest("form")
																		?.requestSubmit();
																}}
															>
																{t(
																	"qualifications.admin.qualifications.deactivate",
																)}
															</button>
														</Form>
													</div>
												))}
											</div>
										)}

										{activeTokens.length === 0 && (
											<p class="text-sm text-gray-400 self-center">
												{t(
													"qualifications.admin.qualifications.noActiveQrCodesFor",
												)}
											</p>
										)}
									</div>
								</div>
							</div>
						);
					})}

					{data.value.types.length === 0 && (
						<div class="text-center py-8 text-gray-500 bg-white rounded-lg shadow-sm">
							{t("qualifications.admin.qualifications.noQualificationTypesYet")}
						</div>
					)}

					{/* Add new type */}
					<div class="bg-white rounded-lg shadow-sm p-6">
						<h3 class="text-lg font-medium text-gray-900 mb-4">
							{t("qualifications.admin.qualifications.addQualificationType")}
						</h3>
						<Form action={createTypeAction} class="grid grid-cols-2 gap-4">
							<div>
								<label
									for="qt-label"
									class="block text-sm font-medium text-gray-700 mb-1"
								>
									{t("qualifications.admin.qualifications.label")}
								</label>
								<input
									id="qt-label"
									type="text"
									name="label"
									required
									placeholder={t(
										"qualifications.admin.qualifications.eGMasterSchoolGraduate",
									)}
									class="w-full border rounded-md px-3 py-2 text-sm"
								/>
							</div>
							<div>
								<label
									for="qt-slug"
									class="block text-sm font-medium text-gray-700 mb-1"
								>
									{t("qualifications.admin.qualifications.slug")}
								</label>
								<input
									id="qt-slug"
									type="text"
									name="slug"
									required
									placeholder={t(
										"qualifications.admin.qualifications.eGMasterSchool",
									)}
									class="w-full border rounded-md px-3 py-2 text-sm font-mono"
								/>
							</div>
							<div>
								<label
									for="qt-grantsMembershipTier"
									class="block text-sm font-medium text-gray-700 mb-1"
								>
									{t(
										"qualifications.admin.qualifications.grantsMembershipTier",
									)}
								</label>
								<select
									id="qt-grantsMembershipTier"
									name="grantsMembershipTier"
									class="w-full border rounded-md px-3 py-2 text-sm"
								>
									<option value="associated">
										{t("qualifications.admin.qualifications.associated")}
									</option>
									<option value="full">
										{t("qualifications.admin.qualifications.full")}
									</option>
								</select>
							</div>
							<div>
								<label
									for="qt-description"
									class="block text-sm font-medium text-gray-700 mb-1"
								>
									{t("qualifications.admin.qualifications.descriptionOptional")}
								</label>
								<input
									id="qt-description"
									type="text"
									name="description"
									placeholder={t(
										"qualifications.admin.qualifications.shownOnUserProfile",
									)}
									class="w-full border rounded-md px-3 py-2 text-sm"
								/>
							</div>
							<div class="col-span-2">
								<button
									type="submit"
									class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
								>
									{t("qualifications.admin.qualifications.addType")}
								</button>
							</div>
						</Form>
					</div>
				</div>
			)}
		</div>
	);
});

import { component$ } from "@qwik.dev/core";
import { formatDate, t } from "~/core/ui";
import { ParticipationSummary } from "../components/ParticipationSummary";
import type { AdminParticipationData } from "./participation-data";

type Props = { data: AdminParticipationData };

export const AdminEventParticipation = component$<Props>(({ data }) => {
	const { event, participationData } = data;

	return (
		<div class="container mx-auto px-4 py-8 max-w-7xl">
			<div class="mb-6">
				<h1 class="text-3xl font-bold text-gray-900">
					{t("events.admin.participation.participationSummary", {
						title: event.title,
					})}
				</h1>
				<p class="mt-2 text-gray-600">
					{t("events.admin.participation.trackWhoPlansToAttend")}
				</p>
			</div>

			{/* Summary Cards */}
			<div class="mb-8">
				<ParticipationSummary summary={participationData.summary} />
			</div>

			{/* Detailed List */}
			<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
				<div class="px-6 py-4 border-b border-gray-200">
					<h2 class="text-xl font-bold text-gray-900">
						{t("events.admin.participation.allResponses")}
					</h2>
				</div>

				{participationData.details.length === 0 ? (
					<div class="px-6 py-8 text-center text-gray-500">
						<p>{t("events.admin.participation.noParticipationResponsesYet")}</p>
					</div>
				) : (
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										{t("events.admin.participation.user")}
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										{t("events.admin.participation.status")}
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										{t("events.admin.participation.foodPreference")}
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										{t("events.admin.participation.photoConsent")}
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										{t("events.admin.participation.lastUpdated")}
									</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{participationData.details.map((participation) => (
									<tr key={participation.id} class="hover:bg-gray-50">
										<td class="px-6 py-4 whitespace-nowrap">
											<div class="text-sm font-medium text-gray-900">
												{participation.user.name}
											</div>
											<div class="text-sm text-gray-500">
												{participation.user.email}
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span
												class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
													participation.status === "yes"
														? "bg-green-100 text-green-800"
														: participation.status === "maybe"
															? "bg-yellow-100 text-yellow-800"
															: "bg-red-100 text-red-800"
												}`}
											>
												{participation.status === "yes"
													? t("events.admin.participation.going")
													: participation.status === "maybe"
														? t("events.admin.participation.maybe")
														: t("events.admin.participation.notGoing")}
											</span>
										</td>
										<td
											class="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
											data-testid="participant-food"
										>
											{participation.foodPreference ?? "—"}
										</td>
										<td
											class="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
											data-testid="participant-photo"
										>
											{participation.photoConsentGiven === null
												? "—"
												: participation.photoConsentGiven
													? t("events.admin.participation.yes")
													: t("events.admin.participation.no")}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatDate(participation.updatedAt, "dateTime")}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
});

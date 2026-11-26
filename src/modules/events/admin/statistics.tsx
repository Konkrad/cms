import { component$ } from "@qwik.dev/core";
import {
	BreakdownBars,
	DemographicsBars,
	formatCurrency,
	HomesBars,
	StatBars,
	StatTile,
	t,
} from "~/core/ui";
import type { AdminEventStatisticsData } from "./statistics-data";

type Props = { data: AdminEventStatisticsData };

/** The statistics tab of an event: from RSVP to check-in, who came and with whom, sales. */
export const AdminEventStatistics = component$<Props>(({ data }) => {
	const { event, stats } = data;
	const noShows = stats.past
		? stats.ticketsIssued - stats.ticketsScanned
		: null;
	return (
		<div class="container mx-auto px-4 py-8 max-w-7xl space-y-6">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">
					{t("events.admin.statistics.title", { title: event.title })}
				</h1>
				<p class="mt-2 text-gray-600">{t("events.admin.statistics.intro")}</p>
			</div>

			<div
				class="grid grid-cols-2 md:grid-cols-4 gap-4"
				data-testid="event-stat-funnel"
			>
				<StatTile
					label={t("events.admin.statistics.rsvpYes")}
					value={stats.rsvp.yes}
					hint={t("events.admin.statistics.rsvpOthers", {
						maybe: stats.rsvp.maybe,
						no: stats.rsvp.no,
					})}
				/>
				<StatTile
					label={t("events.admin.statistics.ticketsIssued")}
					value={stats.ticketsIssued}
					hint={t("events.admin.statistics.seats", {
						count: stats.peopleOnTickets,
					})}
				/>
				<StatTile
					label={t("events.admin.statistics.peopleCame")}
					value={stats.peopleCame}
					hint={t("events.admin.statistics.ticketsScanned", {
						count: stats.ticketsScanned,
					})}
					testId="event-stat-came"
				/>
				<StatTile
					label={t("events.admin.statistics.noShows")}
					value={noShows}
					hint={
						stats.past
							? t("events.admin.statistics.noShowsHint")
							: t("events.admin.statistics.notOverYet")
					}
				/>
			</div>

			<div class="grid gap-4 md:grid-cols-3">
				<StatBars
					title={t("events.admin.statistics.party")}
					rows={[
						{
							label: t("events.admin.statistics.alone"),
							count: stats.party.alone,
						},
						{
							label: t("events.admin.statistics.plusOne"),
							count: stats.party.plusOne,
						},
						{
							label: t("events.admin.statistics.group"),
							count: stats.party.group,
						},
					]}
					testId="event-stat-party"
				/>
				<StatBars
					title={t("events.admin.statistics.firstTimeOrReturning")}
					rows={[
						{
							label: t("events.admin.statistics.firstTime"),
							count: stats.firstTime,
						},
						{
							label: t("events.admin.statistics.returning"),
							count: stats.returning,
						},
						{
							label: t("events.admin.statistics.withoutAccount"),
							count: stats.cameWithoutAccount,
						},
					]}
				/>
				<HomesBars homes={stats.homes} />
			</div>

			<section class="space-y-3">
				<h2 class="text-lg font-semibold text-gray-900">
					{t("events.admin.statistics.whoCame")}
				</h2>
				<DemographicsBars demographics={stats.whoCame} />
				<BreakdownBars breakdowns={stats.breakdowns} />
			</section>

			{stats.products.length > 0 && (
				<section class="bg-white rounded-lg shadow-sm p-5">
					<h2 class="text-sm font-semibold text-gray-700 mb-3">
						{t("events.admin.statistics.sales")}
					</h2>
					<table class="w-full text-sm">
						<thead>
							<tr class="text-left text-gray-500">
								<th class="font-medium py-1">
									{t("events.admin.statistics.product")}
								</th>
								<th class="font-medium py-1 text-right">
									{t("events.admin.statistics.sold")}
								</th>
								<th class="font-medium py-1 text-right">
									{t("events.admin.statistics.revenue")}
								</th>
							</tr>
						</thead>
						<tbody>
							{stats.products.map((p) => (
								<tr key={p.name} class="border-t border-gray-100">
									<td class="py-1.5 text-gray-900">{p.name}</td>
									<td class="py-1.5 text-right tabular-nums">{p.sold}</td>
									<td class="py-1.5 text-right tabular-nums">
										{formatCurrency(p.revenue, "EUR")}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			)}

			<p class="text-xs text-gray-500">{t("events.admin.statistics.note")}</p>
		</div>
	);
});

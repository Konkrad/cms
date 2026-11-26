import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import {
	BreakdownBars,
	DemographicsBars,
	PlacesBars,
	StatColumns,
	StatTile,
} from "~/core/admin/StatBars/StatBars";
import { t } from "~/core/i18n";
import { peopleBreakdowns } from "~/core/registry/statistics";
import { adminUrl } from "~/core/router/scope-path";
import { ADMIN_ACCESS, requireScopeRole } from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { statisticsService } from "~/core/statistics/statistics.service";
import { MIN_GROUP_SIZE } from "~/core/statistics/suppress";
import { ModuleSlot } from "../../../../core/registry/ModuleSlot";

export const useStatistics = routeLoader$(async (event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	return assertNoPrivateFields({
		scopeId: scope.id,
		scopeName: scope.name,
		base: adminUrl(scope.path),
		overview: await statisticsService.overview(scope),
		// The members by what active modules know about them (e.g. qualifications).
		breakdowns: await peopleBreakdowns(
			await statisticsService.memberIds(scope),
		),
	});
});

export default component$(() => {
	const data = useStatistics();
	const o = data.value.overview;
	return (
		<div class="space-y-6">
			<div>
				<h2 class="text-2xl font-bold text-gray-900">
					{t("admin.statistics.title", { scope: data.value.scopeName })}
				</h2>
				<p class="text-sm text-gray-600 mt-1">{t("admin.statistics.intro")}</p>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<StatTile
					label={t("admin.statistics.members")}
					value={o.members}
					testId="stat-members"
				/>
				<StatTile
					label={t("admin.statistics.newLast30Days")}
					value={o.newLast30Days}
				/>
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				<StatColumns
					title={t("admin.statistics.joinedPerMonth")}
					buckets={o.joinedPerMonth}
				/>
				<StatColumns
					title={t("admin.statistics.postsPerMonth")}
					buckets={o.postsPerMonth}
				/>
			</div>

			<section class="space-y-3">
				<h3 class="text-lg font-semibold text-gray-900">
					{t("admin.statistics.whoAreMembers")}
				</h3>
				<DemographicsBars demographics={o.demographics} />
				<BreakdownBars breakdowns={data.value.breakdowns} />
				<PlacesBars demographics={o.demographics} />
			</section>

			{/* Sections of active modules (events, …) */}
			<ModuleSlot
				name="admin.statistics.sections"
				props={{ scopeId: data.value.scopeId, adminBase: data.value.base }}
			/>

			<p class="text-xs text-gray-500">
				{t("admin.statistics.privacyNote", { min: MIN_GROUP_SIZE })}
			</p>
		</div>
	);
});

export const head: DocumentHead = () => ({
	title: t("admin.statistics.headTitle"),
});

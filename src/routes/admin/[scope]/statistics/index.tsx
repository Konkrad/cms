import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import type { StatisticsCompare } from "~/contracts/slots";
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
import { scopesService } from "~/core/scopes/scopes.service";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { statisticsService } from "~/core/statistics/statistics.service";
import { MIN_GROUP_SIZE } from "~/core/statistics/suppress";
import { ModuleSlot } from "../../../../core/registry/ModuleSlot";

export const useStatistics = routeLoader$(async (event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const isRoot = scope.parentId === null;
	// Activity of this level only, or with everything below (default: everything on the root,
	// where the site's own events alone rarely tell the story; this level elsewhere).
	const view = event.url.searchParams.get("view");
	const includeBelow = view ? view === "all" : isRoot;
	const compareParam = event.url.searchParams.get("compare");
	const hasChildren = (await scopesService.getChildren(scope.id)).length > 0;
	const compare: StatisticsCompare | null =
		hasChildren && (compareParam === "leaves" || compareParam === "children")
			? compareParam
			: null;
	return assertNoPrivateFields({
		scopeId: scope.id,
		scopeName: scope.name,
		base: adminUrl(scope.path),
		includeBelow,
		compare,
		hasChildren,
		overview: await statisticsService.overview(scope),
		// The members by what active modules know about them (e.g. qualifications).
		breakdowns: await peopleBreakdowns(
			await statisticsService.memberIds(scope),
		),
	});
});

/** Link to the statistics page with these view settings (kept in the address, so shareable). */
function statisticsHref(
	base: string,
	includeBelow: boolean,
	compare: StatisticsCompare | null,
) {
	const params = new URLSearchParams({ view: includeBelow ? "all" : "own" });
	if (compare) params.set("compare", compare);
	return `${base}/statistics?${params}`;
}

const choice = (active: boolean) =>
	active
		? "px-3 py-1.5 text-sm rounded-md bg-gray-900 text-white"
		: "px-3 py-1.5 text-sm rounded-md text-gray-700 hover:bg-gray-100";

/** Activity of this level only or with everything below; compare the scopes below. */
const ActivityControls = component$<{
	base: string;
	includeBelow: boolean;
	compare: StatisticsCompare | null;
	hasChildren: boolean;
}>(({ base, includeBelow, compare, hasChildren }) => (
	<div
		class="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4"
		data-testid="statistics-controls"
	>
		<span class="text-sm text-gray-600 mr-1">
			{t("admin.statistics.view.label")}
		</span>
		<div class="flex gap-1 bg-white rounded-lg shadow-sm p-1">
			<a
				href={statisticsHref(base, false, compare)}
				class={choice(!includeBelow)}
			>
				{t("admin.statistics.view.own")}
			</a>
			<a
				href={statisticsHref(base, true, compare)}
				class={choice(includeBelow)}
			>
				{t("admin.statistics.view.all")}
			</a>
		</div>
		{hasChildren && (
			<div class="flex gap-1 bg-white rounded-lg shadow-sm p-1 ml-auto">
				{compare ? (
					<>
						<a
							href={statisticsHref(base, includeBelow, "leaves")}
							class={choice(compare === "leaves")}
						>
							{t("admin.statistics.compare.leaves")}
						</a>
						<a
							href={statisticsHref(base, includeBelow, "children")}
							class={choice(compare === "children")}
						>
							{t("admin.statistics.compare.children")}
						</a>
						<a
							href={statisticsHref(base, includeBelow, null)}
							class={choice(false)}
						>
							{t("admin.statistics.compare.hide")}
						</a>
					</>
				) : (
					<a
						href={statisticsHref(base, includeBelow, "leaves")}
						class={choice(false)}
						data-testid="statistics-compare"
					>
						{t("admin.statistics.compare.show")}
					</a>
				)}
			</div>
		)}
	</div>
));

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

			<ActivityControls
				base={data.value.base}
				includeBelow={data.value.includeBelow}
				compare={data.value.compare}
				hasChildren={data.value.hasChildren}
			/>

			{/* Sections of active modules (events, …) */}
			<ModuleSlot
				name="admin.statistics.sections"
				props={{
					scopeId: data.value.scopeId,
					adminBase: data.value.base,
					includeBelow: data.value.includeBelow,
					compare: data.value.compare,
				}}
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

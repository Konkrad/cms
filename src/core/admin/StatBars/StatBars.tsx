import { component$ } from "@qwik.dev/core";
import { formatDate, formatNumber, t } from "~/core/i18n";
import type { Demographics } from "~/core/statistics/statistics.service";
import { MIN_GROUP_SIZE, type StatBucket } from "~/core/statistics/suppress";

/** One row of a breakdown: its label and count (null = a small group, hidden). */
export interface StatRow {
	label: string;
	count: number | null;
}

/**
 * A labelled bar list for statistics: one row per group with its name, a bar on a shared
 * baseline and its number; hidden small groups read "fewer than 5" and draw no bar. One hue, no
 * legend (the heading names the measure); the numbers are always printed, so nothing depends on
 * reading the bar. Admin only (not themeable).
 */
export const StatBars = component$<{
	title: string;
	rows: StatRow[];
	/** Shown instead of the rows when every count is 0. */
	emptyLabel?: string;
	testId?: string;
}>(({ title, rows, emptyLabel, testId }) => {
	const maxCount = Math.max(1, ...rows.map((r) => r.count ?? 0));
	const empty = rows.every((r) => !r.count);
	return (
		<section class="bg-white rounded-lg shadow-sm p-5" data-testid={testId}>
			<h3 class="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
			{empty ? (
				<p class="text-sm text-gray-500">
					{emptyLabel ?? t("admin.statistics.noData")}
				</p>
			) : (
				<ul class="space-y-1.5">
					{rows.map((row) => (
						<li
							key={row.label}
							class="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm"
							title={
								row.count === null
									? `${row.label}: ${t("admin.statistics.fewerThanMin", { min: MIN_GROUP_SIZE })}`
									: `${row.label}: ${formatNumber(row.count)}`
							}
						>
							<span class="truncate text-gray-700">{row.label}</span>
							<span class="h-2 bg-gray-100 rounded-sm">
								{row.count !== null && row.count > 0 && (
									<span
										class="block h-2 rounded-sm bg-blue-600"
										style={{ width: `${(row.count / maxCount) * 100}%` }}
									/>
								)}
							</span>
							<span
								class={
									row.count === null
										? "text-xs text-gray-500 whitespace-nowrap"
										: "tabular-nums text-gray-900 text-right"
								}
							>
								{row.count === null
									? t("admin.statistics.fewerThanMin", { min: MIN_GROUP_SIZE })
									: formatNumber(row.count)}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
});

/** A headline figure (members, active in the last 30 days, …). */
export const StatTile = component$<{
	label: string;
	value: number | null;
	hint?: string;
	testId?: string;
}>(({ label, value, hint, testId }) => (
	<div class="bg-white rounded-lg shadow-sm p-5" data-testid={testId}>
		<div class="text-sm text-gray-600 mb-1">{label}</div>
		<div class="text-3xl font-bold text-gray-900 tabular-nums">
			{value === null
				? t("admin.statistics.fewerThanMin", { min: MIN_GROUP_SIZE })
				: formatNumber(value)}
		</div>
		{hint && <div class="text-xs text-gray-500 mt-1">{hint}</div>}
	</div>
));

/** "Nov 26" for a month key (`YYYY-MM`). */
export function monthLabel(key: string): string {
	return formatDate(`${key}-01T00:00:00Z`, {
		month: "short",
		year: "2-digit",
		timeZone: "UTC",
	});
}

/** Rows of a per-month breakdown (`perMonth`). */
export function monthRows(buckets: StatBucket[]): StatRow[] {
	return buckets.map((b) => ({ label: monthLabel(b.key), count: b.count }));
}

const GROUP_LABELS = {
	age: () => ({
		under18: t("admin.statistics.age.under18"),
		"18to24": t("admin.statistics.age.18to24"),
		"25to34": t("admin.statistics.age.25to34"),
		"35to44": t("admin.statistics.age.35to44"),
		"45to54": t("admin.statistics.age.45to54"),
		"55to64": t("admin.statistics.age.55to64"),
		"65plus": t("admin.statistics.age.65plus"),
		unknown: t("admin.statistics.age.unknown"),
	}),
	gender: () => ({
		female: t("admin.statistics.gender.female"),
		male: t("admin.statistics.gender.male"),
		other: t("admin.statistics.gender.other"),
		prefer_not_to_say: t("admin.statistics.gender.prefer_not_to_say"),
		unknown: t("admin.statistics.gender.unknown"),
	}),
	tier: () => ({
		none: t("admin.statistics.tier.none"),
		associated: t("admin.statistics.tier.associated"),
		full: t("admin.statistics.tier.full"),
	}),
	home: () => ({
		here: t("admin.statistics.home.here"),
		elsewhere: t("admin.statistics.home.elsewhere"),
		noChapter: t("admin.statistics.home.noChapter"),
	}),
} satisfies Record<string, () => Record<string, string>>;

/** Rows of a breakdown of a known group (age, gender, tier, home), labelled. */
function labelled(
	group: keyof typeof GROUP_LABELS,
	buckets: StatBucket[],
): StatRow[] {
	const labels: Record<string, string> = GROUP_LABELS[group]();
	return buckets.map((b) => ({
		label: labels[b.key] ?? b.key,
		count: b.count,
	}));
}

/** Age groups, gender and membership tier of a group of people (`statisticsService.demographicsOf`). */
export const DemographicsBars = component$<{
	demographics: Demographics;
	testId?: string;
}>(({ demographics, testId }) => (
	<div class="grid gap-4 md:grid-cols-3" data-testid={testId}>
		<StatBars
			title={t("admin.statistics.ageGroups")}
			rows={labelled("age", demographics.ageGroups)}
		/>
		<StatBars
			title={t("admin.statistics.gender.title")}
			rows={labelled("gender", demographics.gender)}
		/>
		<StatBars
			title={t("admin.statistics.tier.title")}
			rows={labelled("tier", demographics.tier)}
		/>
	</div>
));

/** Where people belong, seen from a scope (`statisticsService.homesOf`); nothing on the root. */
export const HomesBars = component$<{ homes: StatBucket[]; testId?: string }>(
	({ homes, testId }) =>
		homes.length === 0 ? null : (
			<StatBars
				title={t("admin.statistics.home.title")}
				rows={labelled("home", homes)}
				testId={testId}
			/>
		),
);

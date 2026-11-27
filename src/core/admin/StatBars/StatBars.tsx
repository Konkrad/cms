import { component$ } from "@qwik.dev/core";
import { formatDate, formatNumber, t } from "~/core/i18n";
import type { Demographics } from "~/core/statistics/statistics.service";
import {
	MIN_GROUP_SIZE,
	type PeopleBreakdownResult,
	type StatBucket,
} from "~/core/statistics/suppress";
import { birthPeriodLabel } from "~/core/users/birth-period";

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

/** Birth period, gender and membership tier of a group of people (`statisticsService.demographicsOf`). */
export const DemographicsBars = component$<{
	demographics: Demographics;
	testId?: string;
}>(({ demographics, testId }) => (
	<div class="grid gap-4 md:grid-cols-3" data-testid={testId}>
		<StatBars
			title={t("admin.statistics.birthPeriods")}
			rows={demographics.birthPeriods.map((b) => ({
				label:
					b.key === "unknown"
						? t("admin.statistics.birthPeriodUnknown")
						: birthPeriodLabel(Number(b.key), demographics.birthPeriodYears),
				count: b.count,
			}))}
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
			<StatStack
				title={t("admin.statistics.home.title")}
				parts={labelled("home", homes)}
				testId={testId}
			/>
		),
);

/** The active modules' breakdowns of a group of people (`peopleBreakdowns`), e.g. by qualification. */
export const BreakdownBars = component$<{
	breakdowns: PeopleBreakdownResult[];
}>(({ breakdowns }) =>
	breakdowns.length === 0 ? null : (
		<div class="grid gap-4 md:grid-cols-2" data-testid="stat-breakdowns">
			{breakdowns.map((b) => (
				<StatBars key={b.id} title={b.title} rows={b.rows} />
			))}
		</div>
	),
);

/** Rows of a place breakdown (`Demographics.countries` / `cities`). */
function placeRows(buckets: StatBucket[]): StatRow[] {
	return buckets.map((b) => ({
		label:
			b.key === "other"
				? t("admin.statistics.place.other", { count: b.groups ?? 0 })
				: b.key === "unknown"
					? t("admin.statistics.place.unknown")
					: b.key,
		count: b.count,
	}));
}

/** Where a group of people lives: countries and cities (`statisticsService.demographicsOf`). */
export const PlacesBars = component$<{
	demographics: Demographics;
	testId?: string;
}>(({ demographics, testId }) => (
	<div class="grid gap-4 md:grid-cols-2" data-testid={testId}>
		<p class="md:col-span-2 text-sm text-gray-700">
			{t("admin.statistics.countryCount", {
				count: demographics.countryCount,
			})}
		</p>
		<StatBars
			title={t("admin.statistics.countries")}
			rows={placeRows(demographics.countries)}
		/>
		<StatBars
			title={t("admin.statistics.cities")}
			rows={placeRows(demographics.cities)}
		/>
	</div>
));

/**
 * Counts per month as columns, oldest left (`perMonth` buckets, key `YYYY-MM`). One hue on a
 * shared baseline; every value printed above its column, so nothing depends on reading heights.
 */
export const StatColumns = component$<{
	title: string;
	buckets: StatBucket[];
	testId?: string;
}>(({ title, buckets, testId }) => {
	const maxCount = Math.max(1, ...buckets.map((b) => b.count ?? 0));
	return (
		<section class="bg-white rounded-lg shadow-sm p-5" data-testid={testId}>
			<h3 class="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
			<div class="flex items-end gap-1 h-36">
				{buckets.map((b) => (
					<div
						key={b.key}
						class="flex-1 min-w-0 h-full flex flex-col justify-end items-center"
						title={`${monthLabel(b.key)}: ${
							b.count === null
								? t("admin.statistics.fewerThanMin", { min: MIN_GROUP_SIZE })
								: formatNumber(b.count)
						}`}
					>
						<span class="text-[11px] tabular-nums text-gray-700 mb-0.5">
							{b.count === null ? "–" : formatNumber(b.count)}
						</span>
						<span
							class="w-full max-w-8 bg-blue-600 rounded-t-sm"
							style={{
								height: `${((b.count ?? 0) / maxCount) * 100}%`,
								minHeight: b.count ? "2px" : "0",
							}}
						/>
					</div>
				))}
			</div>
			<div class="flex gap-1 border-t border-gray-200 pt-1">
				{buckets.map((b) => (
					<span
						key={b.key}
						class="flex-1 min-w-0 text-center text-[11px] text-gray-500 truncate"
					>
						{formatDate(`${b.key}-01T00:00:00Z`, {
							month: "short",
							timeZone: "UTC",
						})}
					</span>
				))}
			</div>
		</section>
	);
});

/** Shades for the parts of a stacked bar, darkest first (ordered groups read dark to light). */
const STACK_SHADES = [
	"bg-blue-800",
	"bg-blue-600",
	"bg-blue-400",
	"bg-blue-300",
	"bg-blue-200",
	"bg-gray-300",
	"bg-gray-200",
] as const;

/**
 * Parts of a whole as one bar (e.g. engagement levels), in the given order, with a legend of
 * label, number and share below. Parts that are hidden (null) or 0 draw no segment.
 */
export const StatStack = component$<{
	title: string;
	parts: StatRow[];
	testId?: string;
}>(({ title, parts, testId }) => {
	const total = parts.reduce((sum, p) => sum + (p.count ?? 0), 0);
	return (
		<section class="bg-white rounded-lg shadow-sm p-5" data-testid={testId}>
			<h3 class="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
			{total === 0 ? (
				<p class="text-sm text-gray-500">{t("admin.statistics.noData")}</p>
			) : (
				<>
					<div class="flex h-4 rounded-sm overflow-hidden gap-0.5 bg-white">
						{parts.map((p, i) =>
							p.count ? (
								<span
									key={p.label}
									class={STACK_SHADES[i % STACK_SHADES.length]}
									style={{ width: `${(p.count / total) * 100}%` }}
									title={`${p.label}: ${formatNumber(p.count)}`}
								/>
							) : null,
						)}
					</div>
					<ul class="mt-3 grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-1 text-sm items-center">
						{parts.map((p, i) => (
							<li key={p.label} class="contents">
								<span
									class={`inline-block w-2.5 h-2.5 rounded-sm ${STACK_SHADES[i % STACK_SHADES.length]}`}
								/>
								<span class="text-gray-700 truncate">{p.label}</span>
								<span
									class={
										p.count === null
											? "text-xs text-gray-500 text-right whitespace-nowrap"
											: "tabular-nums text-gray-900 text-right"
									}
								>
									{p.count === null
										? t("admin.statistics.fewerThanMin", {
												min: MIN_GROUP_SIZE,
											})
										: formatNumber(p.count)}
								</span>
								<span class="tabular-nums text-xs text-gray-500 text-right w-10">
									{p.count === null
										? ""
										: formatNumber(p.count / total, { style: "percent" })}
								</span>
							</li>
						))}
					</ul>
				</>
			)}
		</section>
	);
});

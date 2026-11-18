import { describe, expect, it, vi } from "vitest";
import { buildCatalog } from "~/core/i18n/build-catalog";
import { createFormatters } from "~/core/i18n/format";
import { INTL_LOCALES, siteLocaleSchema } from "~/core/i18n/locales";
import { createTranslator, interpolate } from "~/core/i18n/translate";

const en = {
	"core.hello": "Hello {name}",
	"core.twice": "{name} and {name} again, {count} times",
	"core.tickets_one": "{count} ticket",
	"core.tickets_other": "{count} tickets",
	"core.onlyOther_other": "{count} things",
	"core.onlyEnglish": "Only in English",
};
const de = {
	"core.hello": "Hallo {name}",
	"core.twice": "{name} und nochmal {name}, {count} Mal",
	"core.tickets_one": "{count} Ticket",
	"core.tickets_other": "{count} Tickets",
	"core.onlyOther_other": "{count} Dinge",
};

describe("interpolate", () => {
	it("fills placeholders, repeats, numbers, and keeps unknown ones", () => {
		expect(interpolate("Hi {a}, {a} {b} {c}", { a: "x", b: 2 })).toBe(
			"Hi x, x 2 {c}",
		);
		expect(interpolate("No params {x}")).toBe("No params {x}");
	});
});

describe("createTranslator", () => {
	it("looks up and interpolates", () => {
		const t = createTranslator({ intlLocale: "de-DE", messages: de });
		expect(t("core.hello", { name: "Ana" })).toBe("Hallo Ana");
		expect(t("core.twice", { name: "B", count: 3 })).toBe(
			"B und nochmal B, 3 Mal",
		);
	});

	it("picks the plural form with Intl.PluralRules", () => {
		const tEn = createTranslator({ intlLocale: "en-GB", messages: en });
		expect(tEn("core.tickets", { count: 1 })).toBe("1 ticket");
		expect(tEn("core.tickets", { count: 0 })).toBe("0 tickets");
		expect(tEn("core.tickets", { count: 2 })).toBe("2 tickets");
		const tDe = createTranslator({ intlLocale: "de-DE", messages: de });
		expect(tDe("core.tickets", { count: 1 })).toBe("1 Ticket");
		expect(tDe("core.tickets", { count: 5 })).toBe("5 Tickets");
		// no `_one` form: `_other` is used
		expect(tDe("core.onlyOther", { count: 1 })).toBe("1 Dinge");
	});

	it("falls back to English and reports each key once", () => {
		const onMissing = vi.fn();
		const t = createTranslator({
			intlLocale: "de-DE",
			messages: de,
			fallback: en,
			onMissing,
		});
		expect(t("core.onlyEnglish")).toBe("Only in English");
		expect(t("core.onlyEnglish")).toBe("Only in English");
		expect(onMissing).toHaveBeenCalledTimes(1);
		expect(onMissing).toHaveBeenCalledWith("core.onlyEnglish", "fallback");
	});

	it("returns the key itself for an unknown key and reports it", () => {
		const onMissing = vi.fn();
		const t = createTranslator({
			intlLocale: "en-GB",
			messages: en,
			fallback: en,
			onMissing,
		});
		expect(t("core.nope")).toBe("core.nope");
		expect(onMissing).toHaveBeenCalledWith("core.nope", "unknown");
	});
});

describe("buildCatalog", () => {
	const sources = {
		core: { en: { "core.a": "A", "core.b": "B" }, de: { "core.a": "Ä" } },
		theme: { en: { "theme.x": "X" }, de: { "theme.x": "Iks" } },
		modules: {
			jobs: { en: { "jobs.title": "Jobs" }, de: { "jobs.title": "Stellen" } },
			deals: { en: { "deals.title": "Deals" } },
		},
	};

	it("merges core, theme and active modules over English", () => {
		const built = buildCatalog("de", ["jobs"], sources);
		expect(built.locale).toBe("de");
		expect(built.messages).toEqual({
			"core.a": "Ä",
			"core.b": "B",
			"theme.x": "Iks",
			"jobs.title": "Stellen",
		});
		expect(built.fallbackKeys).toEqual(["core.b"]);
	});

	it("leaves out inactive modules and reports module keys that fell back", () => {
		const built = buildCatalog("de", ["deals"], sources);
		expect(built.messages["jobs.title"]).toBeUndefined();
		expect(built.messages["deals.title"]).toBe("Deals");
		expect(built.fallbackKeys).toEqual(["core.b", "deals.title"]);
	});

	it("serves English as is", () => {
		const built = buildCatalog("en", ["jobs", "deals"], sources);
		expect(built.messages["core.a"]).toBe("A");
		expect(built.fallbackKeys).toEqual([]);
	});
});

describe("formatters", () => {
	const en = createFormatters(INTL_LOCALES.en);
	const de = createFormatters(INTL_LOCALES.de);
	const date = new Date(2026, 9, 12, 14, 30);

	it("formats dates per locale with presets and raw options", () => {
		expect(en.formatDate(date)).toBe("12 Oct 2026");
		expect(de.formatDate(date)).toBe("12. Okt. 2026");
		expect(en.formatDate(date, "dateLong")).toBe("12 October 2026");
		expect(de.formatDate(date, "dateLong")).toBe("12. Oktober 2026");
		expect(en.formatDate(date, "time")).toBe("14:30");
		expect(de.formatDate(date, "month")).toBe("Oktober");
		expect(en.formatDate(date.toISOString(), { year: "numeric" })).toBe("2026");
		expect(de.formatDate(date.getTime(), "weekdayDate")).toBe(
			"Montag, 12. Oktober 2026",
		);
	});

	it("formats numbers and money per locale", () => {
		expect(en.formatNumber(1234.5)).toBe("1,234.5");
		expect(de.formatNumber(1234.5)).toBe("1.234,5");
		expect(en.formatCurrency(12.5, "eur")).toBe("€12.50");
		expect(de.formatCurrency(12.5, "EUR")).toBe("12,50 €");
		expect(en.formatMoney(1250, "eur")).toBe("€12.50");
		expect(de.formatMoney(1250, "eur")).toBe("12,50 €");
	});
});

describe("SITE_LOCALE", () => {
	it("defaults to en and accepts only shipped locales", () => {
		expect(siteLocaleSchema.parse(undefined)).toBe("en");
		expect(siteLocaleSchema.parse("de")).toBe("de");
		expect(siteLocaleSchema.safeParse("fr").success).toBe(false);
	});
});

describe("validation messages", () => {
	it("maps the router's zod issues through the catalog", async () => {
		const { validationMessage } = await import(
			"~/core/i18n/validation-messages"
		);
		const issue = (fields: Record<string, unknown>) =>
			validationMessage({ path: [], message: "", ...fields } as never);
		expect(issue({ code: "invalid_type", received: "undefined" })).toBe(
			"Required",
		);
		expect(issue({ code: "too_small", type: "string", minimum: 1 })).toBe(
			"Required",
		);
		expect(issue({ code: "too_small", type: "string", minimum: 3 })).toBe(
			"At least 3 characters",
		);
		expect(issue({ code: "too_big", type: "string", maximum: 1 })).toBe(
			"At most 1 character",
		);
		expect(issue({ code: "invalid_string", validation: "email" })).toBe(
			"Invalid email address",
		);
		expect(issue({ code: "invalid_enum_value" })).toBe(
			"Pick one of the options",
		);
		expect(issue({ code: "custom" })).toBeUndefined();
	});
});

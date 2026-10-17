/**
 * The pure translation runtime: lookup, `{name}` interpolation, plurals and fallback.
 * `t` in `./index.ts` is this bound to the site's catalog; tests build their own translator.
 */

export type Messages = Readonly<Record<string, string>>;
export type TranslateParams = Readonly<Record<string, string | number>>;

/** Plural categories `Intl.PluralRules` returns; `<key>_<category>` holds that form. */
export const PLURAL_CATEGORIES = [
	"zero",
	"one",
	"two",
	"few",
	"many",
	"other",
] as const;

export type TranslatorOptions = {
	/** `Intl` locale for the plural rules (e.g. `de-DE`). */
	intlLocale: string;
	/** The site locale's messages (already merged over English by the catalog build, or not). */
	messages: Messages;
	/** English messages for keys `messages` lacks (unit tests, unmerged catalogs). */
	fallback?: Messages;
	/** Called once per key that fell back to English or is missing everywhere. */
	onMissing?: (key: string, kind: "fallback" | "unknown") => void;
};

const PLACEHOLDER = /\{(\w+)\}/g;

/** Replaces `{name}` with `params.name`; unknown placeholders stay as they are. */
export function interpolate(message: string, params?: TranslateParams): string {
	if (!params) return message;
	return message.replace(PLACEHOLDER, (match, name: string) =>
		Object.hasOwn(params, name) ? String(params[name]) : match,
	);
}

/**
 * `t(key, params?)`: the message for `key` with `{name}` placeholders filled. With a numeric
 * `params.count`, `<key>_<plural category>` (`Intl.PluralRules`) is used, then `<key>_other`,
 * then `<key>`. A key missing in `messages` comes from `fallback`; missing everywhere, the key
 * itself is returned (and reported).
 */
export function createTranslator(options: TranslatorOptions) {
	const { messages, fallback, onMissing } = options;
	const plurals = new Intl.PluralRules(options.intlLocale);
	const reported = new Set<string>();
	const report = (key: string, kind: "fallback" | "unknown") => {
		if (!onMissing || reported.has(key)) return;
		reported.add(key);
		onMissing(key, kind);
	};

	const candidates = (key: string, params?: TranslateParams): string[] => {
		const count = params?.count;
		if (typeof count !== "number") return [key];
		return [`${key}_${plurals.select(count)}`, `${key}_other`, key];
	};

	return (key: string, params?: TranslateParams): string => {
		const keys = candidates(key, params);
		for (const k of keys) {
			const message = messages[k];
			if (message !== undefined) return interpolate(message, params);
		}
		if (fallback) {
			for (const k of keys) {
				const message = fallback[k];
				if (message !== undefined) {
					report(k, "fallback");
					return interpolate(message, params);
				}
			}
		}
		report(key, "unknown");
		return key;
	};
}

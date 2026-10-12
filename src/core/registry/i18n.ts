/**
 * Message catalogs of core, the theme and every module (spec 4.8), imported by relative path
 * like the other registry files. Only ACTIVE modules' catalogs are served (`buildCatalog`).
 * A module adds `src/modules/<id>/i18n/en.json` (namespace `<id>.*`, plus any other locale)
 * and one entry here; `tests/unit/i18n-catalogs.spec.ts` checks the folders match.
 */

import themeDe from "../../../theme/i18n/de.json" with { type: "json" };
import themeEn from "../../../theme/i18n/en.json" with { type: "json" };
import dealsDe from "../../modules/deals/i18n/de.json" with { type: "json" };
import dealsEn from "../../modules/deals/i18n/en.json" with { type: "json" };
import electionsDe from "../../modules/elections/i18n/de.json" with {
	type: "json",
};
import electionsEn from "../../modules/elections/i18n/en.json" with {
	type: "json",
};
import eventsDe from "../../modules/events/i18n/de.json" with { type: "json" };
import eventsEn from "../../modules/events/i18n/en.json" with { type: "json" };
import jobsDe from "../../modules/jobs/i18n/de.json" with { type: "json" };
import jobsEn from "../../modules/jobs/i18n/en.json" with { type: "json" };
import qualificationsDe from "../../modules/qualifications/i18n/de.json" with {
	type: "json",
};
import qualificationsEn from "../../modules/qualifications/i18n/en.json" with {
	type: "json",
};
import socialWebDe from "../../modules/social-web/i18n/de.json" with {
	type: "json",
};
import socialWebEn from "../../modules/social-web/i18n/en.json" with {
	type: "json",
};
import type { CatalogSources } from "../i18n/build-catalog";
import coreDe from "../i18n/de.json" with { type: "json" };
import coreEn from "../i18n/en.json" with { type: "json" };

export const catalogSources = {
	core: { en: coreEn, de: coreDe },
	theme: { en: themeEn, de: themeDe },
	modules: {
		deals: { en: dealsEn, de: dealsDe },
		elections: { en: electionsEn, de: electionsDe },
		events: { en: eventsEn, de: eventsDe },
		jobs: { en: jobsEn, de: jobsDe },
		qualifications: { en: qualificationsEn, de: qualificationsDe },
		"social-web": { en: socialWebEn, de: socialWebDe },
	},
} satisfies CatalogSources;

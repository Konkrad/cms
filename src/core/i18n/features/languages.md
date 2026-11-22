---
status: shipped
code:
  - src/core/i18n/translate.ts
  - src/core/i18n/format.ts
  - src/core/i18n/vite-plugin.ts
  - src/core/i18n/en.json
  - src/core/i18n/de.json
tags: [architecture, i18n]
---
# Languages

Each installation runs in **one language**: English or German. There is no language switcher.

## Rules
- The language is chosen when the site is built; the server refuses to start with a different one.
- All texts come from translation catalogs: core, theme and each module have their own. A missing German text falls back to English.
- Dates, numbers and money are formatted for the site's language.
- Content written by people (posts, pages, events) is not translated.
- Every catalog must have exactly the same texts as the English one; an automatic check enforces this.

## Decisions
- One language per site keeps the pages small and simple; the organisations using it work in one language each.

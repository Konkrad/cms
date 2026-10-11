---
name: theme
description: Use when editing anything in theme/ (blocks, chrome, emails, routes, shared, tokens), creating or changing UI components, shared UI primitives or form elements, colors/fonts/tokens, qwikify$ React components, contracts in src/contracts, page-builder blocks or headless composables, or when deciding whether code belongs in theme or core.
---

# Theme vs core, contracts, UI

The presentational layer for public-facing routes lives in `theme/` and is licensed separately from core (`theme/LICENSE`). The admin panel is core and is **not** themeable. See `theme/README.md` for the folder layout.

## Route / theme split

- **Qwik City forces route files to stay in `src/routes/**`.** A route file keeps its `routeLoader$`/`routeAction$`/`onRequest`/`head`/auth, strips secrets, then delegates rendering to a theme `*View` component, passing loader data as typed props.
- **The props type is the contract.** Contracts live in `src/contracts/*.ts`. Pages that show another user's data declare their payload type there and the loader returns it (`satisfies` / explicit return type); for other pages it may be derived from the loader (`NonNullable<ReturnType<typeof useX>["value"]>`) and re-exported from `src/contracts/*.ts`. Module page types (`JobsListData`, ...) are declared the same way.
- Theme components import only from `~/contracts/*` and, where a block/view needs live data after SSR (pagination, "Load More"), a core-owned **headless composable**. Never `db`, `env`, services, `~/core` or `~/core/auth/*` directly.
- Visibility is decided in the loader/service; the theme only renders what it gets and never hides data with conditionals (CLAUDE.md Security).

## Headless composables and blocks

- **Page-builder blocks have no route loader**, so each "dynamic" block delegates data-fetching/pagination to a composable: core ones under `src/core/content/builder/blocks/use*.ts` (`useGroupsList`, `useHeroSection`, `usePostsList`); module blocks live in the module (`src/modules/events/useUpcomingEvents.ts`, `useUpcomingEvents`/`usePastEvents`, `src/modules/deals/useDealsList.ts`). Plain functions using `useSignal`/`useTask$`/`server$()`, Qwik's native "custom hook" pattern.
- The composable owns the service/db/auth calls and any `server$()` RPC boundary; the theme block (`theme/blocks/**`) only calls the composable and renders the returned signals. Same split for the `/jobs` list pagination (`src/modules/jobs/useJobsPagination.ts`). Mark the block `category: "dynamic"`. See `src/core/content/builder/README.md`.
- `BlockDefinition`/`FieldDefinition`/`BlockData` (needed by every block for registration) are re-exported type-only from `src/contracts/blocks.ts`, so blocks never import `~/core/*/schema` either.
- Module-owned block types are also listed in the module's `blocks.ts` and `src/core/registry/blocks.ts` (see `add-module`).

## Enforced boundary

`biome.json` has a `noRestrictedImports` override scoped to `theme/**` that fails the build on any import of `~/core` (module API root), `~/core/schema`, `~/core/db/**`, `~/core/*/*.service`, `~/core/*/schema` (and `/**`), `~/core/auth/**`, or `~/env`. Run `npx biome lint theme`. When adding a new dynamic block or live data need, add a composable in core (or the module) first; do not import a service directly from `theme/**` to work around the rule.

## Imports and the Qwik production-build footgun

- Import theme code via the `~theme/*` alias (`~theme/chrome`, `~theme/blocks`, `~theme/routes/**`, `~theme/shared/**`). Never import theme code from a route file via a relative path.
- A re-exported `routeAction$`/`routeLoader$` is only resolved correctly by the production Rollup transform when re-exported via a **relative** import path, never `~` or `~theme`. When a step/widget bundles an action with JSX (see `src/core/users/setup/README.md`), split it: the action stays in core (`src/core/<area>/**/useXxx.ts`, re-exported relatively from the route), the JSX moves to `theme/shared/**` (imported via `~theme`; only the action re-export hits the broken transform).
- **Check usage per exported component, not per file.** A file can export several components where only some are theme-exclusive; check what each consuming route imports before moving or splitting (e.g. `ParticipationToggle` vs `ParticipationSummary`, split because only the public route used the toggle and only the admin route used the summary).

## Admin is not themeable

Admin stays un-themeable via the `.admin-shell` scope in `src/global.css`, which re-pins brand token values; `src/routes/admin/layout.tsx` wraps admin in it. Never let an admin-only component read brand tokens (`--color-primary*`, `--color-accent*`) expecting theme values to apply.

## Tokens

Design tokens (colors, fonts, radii, shadows) are defined once in `theme/tokens/theme.css` (Tailwind `@theme {}` block) and `theme/tokens/tokens.ts` (TS constants for emails/inline styles), with a core fallback set in `src/design/tokens.css`. Never hardcode hex colors or font stacks in components or emails; reference a token. `src/design/DESIGN.md` has the full palette; `theme/emails/brand.ts` has email-specific brand strings.

## UI components

- React components used through `qwikify$()` must be self-contained: keep their CSS alongside the component.
- Before creating any shared UI primitive or form element, read `src/design/DESIGN.md` and import primitives from `~/components/ui` only (modules get them through `~/core/ui`).

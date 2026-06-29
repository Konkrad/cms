# Theme layer

This folder is the **theme / skin** unit. It is licensed separately from the
core application (see [`LICENSE`](./LICENSE)). A community can fork or replace
this folder to reskin the public site without touching core logic.

## What lives here

- `tokens/` — design tokens. `theme.css` holds the Tailwind v4 `@theme {}` block
  (brand colors → utility generation + `:root` variables). `tokens.ts` exposes
  the same values as TypeScript constants for email/inline styles.
- `chrome/` — public layout chrome (Navigation, SiteFooter). *(Phase 1)*
- `blocks/` — page-block components rendered by the page builder. *(Phase 1)*
- `routes/` — presentational components for the public routes (one `*View` per
  route). Each receives a typed, secret-stripped props object produced by the
  corresponding route loader in `src/routes/**`.
- `editor/` — custom BlockNote render components. *(Phase 3)*
- `emails/` — email chrome and brand config: `EmailLayout`/`Header`/`Footer`
  (full presentational building blocks — no branding props, a theme just
  hardcodes its own logo/copy/colors) and `brand.ts` (site name / logo alt /
  footer copyright, used internally by Header/Footer and referenced by core
  templates for body copy). Core's actual email templates
  (`src/emails/LoginEmail.tsx`, `TicketConfirmation.tsx`, and the data-bound
  blocks `TicketLinksSection`/`TransactionProductsSummary`) stay in core — they
  carry real transactional data — but render inside `~theme/emails/EmailLayout`.

## The boundary

Route files stay in `src/routes/**` (Qwik City is file-based). Each route keeps
its loaders / actions / `onRequest` / `head` / auth (core) and **strips secrets
in the loader** before delegating rendering to a theme `*View` component.

The **props type is the contract**: it is derived from the loader and re-exported
from `src/contracts/**`. Theme components import `~/contracts/*` and **must not**
import `db`, `env`, services, or `~/utils/server-auth`.

The **admin panel is core and is not themeable.** Its token values are pinned via
the `.admin-shell` scope in `src/global.css`, so theme brand changes never leak
into the admin UI.

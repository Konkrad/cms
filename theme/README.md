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
- `emails/` — the full email layer, including the templates themselves.
  `EmailLayout`/`Header`/`Footer` are pure chrome (no branding props, a theme
  just hardcodes its own logo/copy/colors). `brand.ts` holds site name / logo
  alt / footer copyright. `LoginEmail`/`TicketConfirmation` are the templates,
  and `TicketLinksSection`/`TransactionProductsSummary` are their data-bound
  blocks — these still take real props (tickets, products, amounts) since that
  data is core-owned, but all markup/copy/styling is theme. `static/logo.svg`
  is the brand asset served at `${baseUrl}/static/logo.svg`. Core only computes
  the props (`src/services/email-notifications.service.ts`, the "loader"
  equivalent — date formatting, env access) and calls `render()`/`sendEmail()`
  against `~theme/emails/LoginEmail` / `~theme/emails/TicketConfirmation` —
  the same loader/View split used for routes.

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

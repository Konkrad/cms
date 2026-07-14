# Building a custom theme

This is for someone standing up a new deployment of this CMS with its own
branding — e.g. a specific alumni chapter's site. The admin panel (`/admin`)
is core UI and is never themed; everything a *member* sees on the public
site is.

## The folder structure a theme provides

A theme is a `theme/` directory with this shape:

- **`tokens/`** — `theme.css` (a Tailwind v4 `@theme{}` block defining brand
  colors — primary, accent, text, borders, etc. — compiled into utility
  classes like `bg-primary`/`text-text-heading`) and `tokens.ts` (the same
  color values as plain TS constants, needed because email clients can't
  read CSS custom properties). **Never hardcode a hex color anywhere in a
  component or email — always reference a token.** Non-color tokens
  (radii, shadows, fonts) fall back to core's `src/design/tokens.css` if a
  theme doesn't override them.
- **`chrome/`** — site-wide layout wrapping every page: `Navigation/`,
  `SiteFooter/`.
- **`blocks/`** — page-builder blocks (e.g. a hero section, an upcoming-events
  list, a posts list) that admins compose pages out of via the visual page
  builder. Blocks are the one place theme code is allowed to self-fetch
  data via `server$()`, since the page builder has no route loader to hand
  them props.
- **`routes/`** — one `*View` component per public route (e.g.
  `EventView`, `CheckoutView`), each receiving typed, already
  secrets-stripped props from the matching core `src/routes/**` loader. A
  theme route component never imports `db`, `env`, or a service directly.
- **`shared/`** — smaller presentational widgets reused across routes
  (e.g. a location-picker step, a participation toggle).
- **`emails/`** — the entire email layer: layout chrome, brand strings, and
  templates (login email, ticket confirmation, etc.).

## Wiring it into core

Theme code is imported into core exclusively through the `~theme/*` alias
(`~theme/chrome`, `~theme/blocks`, `~theme/routes/**`, `~theme/shared/**`)
— never a relative path from a core route file.

**The one sharp edge:** Qwik City's production Rollup transform for
re-exported `routeAction$`/`routeLoader$` does not resolve the `~` or
`~theme` tsconfig aliases — only a relative import path works for those
specifically. In practice this means: if a themed widget bundles a server
action together with its JSX (a step in a multi-step flow, say), split it —
the action stays in **core** (e.g.
`src/components/some-feature/useDoTheThing.ts`), re-exported *relatively*
from the route file that uses it; the JSX/presentation moves to
**theme**, imported via the `~theme` alias as normal. Only the action
re-export needs the relative-path workaround.

## The admin panel is exempt from theming, on purpose

`src/global.css`'s `.admin-shell` scope re-pins the brand token values
(`--color-primary*`, `--color-accent*`) back to fixed core defaults, and
`src/routes/admin/layout.tsx` wraps the whole admin panel in that scope. An
admin-only component should never expect a theme's brand colors to apply to
it — if you're building new admin UI and it looks themed, something's
wrong.

## How a deployment repo actually ships its theme

A deployment repo (like a specific chapter's site) is a thin wrapper: its
own `theme/` directory, deploy config, and any data-import scripts — no
fork of core. At build time, its Dockerfile clones a fresh checkout of this
core repo, then `COPY`s the deployment repo's own files (its `theme/`
directory, `public/` assets, etc.) directly on top before running the
production build. The deployment repo never needs to touch core source at
all; the whole customization surface is the `~theme/*`-importable
directory described above.

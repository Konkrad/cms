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

## Dev image + theme folder mapping

Core publishes a dev image — `ghcr.io/konkrad/cms:dev`, built from
`Dockerfile.dev` — alongside the production image, from the same CI job
(`.github/workflows/ci.yml`). It bakes in core's full source and
`node_modules`, and runs `npm start` (`vite --mode ssr --host 0.0.0.0`) as
its command instead of a production build.

Because Vite's dev server compiles on demand per file (unlike `vite build`),
a deployment repo can bind-mount its own `theme/` directory straight over
the image's default one and get true hot reload — no core checkout, no
build step, no custom tooling on the deployment repo's side. Editing a file
under the mounted `theme/` shows up as a `[vite] (ssr) page reload ...` in
the container logs a couple of seconds later.

```
docker compose up
open http://localhost:3100
```

See `docker-compose.yml` in a deployment repo (e.g. `cms-deploy`) for the
full setup — it maps `./theme:/app/theme` and `./data:/data` onto the `:dev`
image alongside local mailpit/minio/stripe-mock, so nothing needs real
SMTP/S3/Stripe to boot. Only `theme/` is mounted, not the whole app, so
`node_modules` (including native modules like `better-sqlite3`) stays
inside the image regardless of host platform.

This is local-dev tooling only — it has no bearing on how a deployment
repo actually ships to production; see below.

## Theme-owned dependencies

A theme sometimes needs an npm package core doesn't have (e.g. a brand icon
set published to a private registry). Core's own `package.json`/
`package-lock.json` are the only ones that matter for what actually ships —
a deployment repo cannot introduce a new runtime dependency by having its
own `package.json`, since core never installs from it.

Instead, `docker/dev-entrypoint.sh` (wired in as `Dockerfile.dev`'s
`ENTRYPOINT`) looks for two **bind-mounted, optional** files at container
start and, if present, installs them additively into the image's existing
`node_modules` — core's own dependency tree is never touched:

- `/app/theme-package.json` — a deployment repo's own `package.json`; only
  its `dependencies` are read.
- `/app/theme-npmrc` — that repo's own `.npmrc`, if a dependency lives on a
  scoped/private registry (e.g. GitHub Packages). Typically references an
  auth token by env var (`//npm.pkg.github.com/:_authToken=${NPM_TOKEN}`),
  never the literal secret.

A deployment repo's `docker-compose.yml` wires these in like any other
bind mount, alongside the existing `theme/` one:

```yaml
services:
  app:
    image: cms:dev
    volumes:
      - ./theme:/app/theme
      - ./data:/data
      - ./package.json:/app/theme-package.json:ro
      - ./.npmrc:/app/theme-npmrc:ro
    environment:
      NPM_TOKEN: ${NPM_TOKEN} # only needed if theme-npmrc references one
```

This installs on every `docker compose up` (not at image build time — a
bind mount doesn't exist yet during `docker build`), so there's no separate
build step for a theme dependency change: edit `package.json`, restart the
container. The installed packages live only in that container's writable
layer, not the image, so they don't persist across a `docker compose down`
— intentional, keeps the base `:dev` image itself untouched and shared
across every deployment repo using it.

A theme component importing such a package should defer any
`window`/`HTMLElement`-touching side effects (e.g. a Web Component's
`customElements.define`) to run client-only — e.g. inside a Qwik
`useVisibleTask$` — since the dev server also runs this code path during
SSR, where those globals don't exist.

## How a deployment repo actually ships its theme

A deployment repo (like a specific chapter's site) is a thin wrapper: its
own `theme/` directory, deploy config, and any data-import scripts — no
fork of core. At build time, its Dockerfile clones a fresh checkout of this
core repo, then `COPY`s the deployment repo's own files (its `theme/`
directory, `public/` assets, etc.) directly on top before running the
production build. The deployment repo never needs to touch core source at
all; the whole customization surface is the `~theme/*`-importable directory
described above.

#!/bin/sh
set -e

# Optional theme-owned dependencies: a deployment repo can bind-mount its own
# package.json (and .npmrc, if it needs a scoped/private registry) over
# /app/theme-package.json and /app/theme-npmrc. If present, install those
# dependencies additively into this image's node_modules — core's own
# package.json/package-lock.json are never touched. This runs on every
# container start (not at image build time), since a bind mount doesn't
# exist yet during `docker build` — only once the container actually starts
# with the volume attached. See docs/theme-development.md.
#
# Re-running `npm install` here is cheap when nothing changed (npm no-ops),
# and the installed packages live only in this container's writable layer —
# they don't persist across a `docker compose down`, so this re-runs on
# every `up`. That's deliberate: no separate image build step for a theme
# dependency change, just edit package.json and restart.
if [ -f /app/theme-package.json ]; then
  echo "Found theme-package.json — installing theme dependencies..."
  cp /app/theme-package.json /app/node_modules/.theme-package.json
  [ -f /app/theme-npmrc ] && cp /app/theme-npmrc /app/.npmrc

  THEME_DEPS=$(node -e '
    const deps = require("/app/node_modules/.theme-package.json").dependencies || {};
    console.log(Object.entries(deps).map(([name, version]) => name + "@" + version).join(" "));
  ')

  if [ -n "$THEME_DEPS" ]; then
    # shellcheck disable=SC2086
    npm install --no-save $THEME_DEPS
  else
    echo "theme-package.json has no dependencies — nothing to install."
  fi

  [ -f /app/theme-npmrc ] && rm -f /app/.npmrc
  rm -f /app/node_modules/.theme-package.json
fi

exec "$@"

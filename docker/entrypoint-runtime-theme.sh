#!/bin/sh
set -e

: "${DB_PATH:?DB_PATH must be set (e.g. /data/db.sqlite)}"

# Runtime theme loading: this image ships full build tooling (unlike the
# plain Dockerfile's slim runtime stage) so the actual `vite build` can run
# here, at container startup, against whichever theme/ is in place —
# instead of at `docker build` time. That's what lets one published image
# serve any theme: swap the mounted directory and restart the container, no
# image rebuild. See docs/deployment.md ("Runtime theme build").
#
# THEME_SRC defaults to /theme-src, the mount point declared in
# Dockerfile.runtime-theme (bind mount, ConfigMap, PVC — whatever the
# deployer's orchestrator supports). When nothing is mounted there, it's
# either absent or an empty directory (Docker auto-creates an anonymous
# volume for a declared VOLUME with nothing bound to it), and the build
# falls back to the image's own bundled theme/ — handy for smoke-testing
# this image standalone.
THEME_SRC="${THEME_SRC:-/theme-src}"
if [ -d "$THEME_SRC" ] && [ -n "$(ls -A "$THEME_SRC" 2>/dev/null)" ]; then
  echo "Overlaying mounted theme from $THEME_SRC onto theme/..."
  rm -rf /app/theme
  cp -r "$THEME_SRC" /app/theme
else
  echo "No theme mounted at $THEME_SRC — using the image's bundled default theme."
fi

# Full build, every container start. There's no cross-build artifact reuse
# here (contrast Dockerfile.theme-overlay) — simpler, at the cost of
# startup latency. See docs/deployment.md for the tradeoff.
echo "Building app..."
npm run build.client
npm run build.server

# Disaster recovery: if the volume has no database yet (fresh server / replaced
# volume), restore the latest snapshot from the object-storage replica. No-op when
# no replica exists yet (first ever boot).
if [ ! -f "$DB_PATH" ]; then
  echo "No database at $DB_PATH — attempting Litestream restore from replica..."
  litestream restore -if-replica-exists -config /app/litestream.yml "$DB_PATH" || true
fi

# Migrations are applied by the server itself (src/db/migrate.ts, called from
# entry.node-server.tsx before it starts listening) — no separate step here.

# Run the server supervised by Litestream so the SQLite WAL is continuously
# replicated to the bucket. Litestream forwards signals and exits with the child.
echo "Starting server under Litestream replication..."
exec litestream replicate -config /app/litestream.yml \
  -exec "node server/entry.node-server.js"

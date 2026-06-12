#!/bin/sh
set -e

: "${DB_PATH:?DB_PATH must be set (e.g. /data/db.sqlite)}"

# Disaster recovery: if the volume has no database yet (fresh server / replaced
# volume), restore the latest snapshot from the object-storage replica. No-op when
# no replica exists yet (first ever boot).
if [ ! -f "$DB_PATH" ]; then
  echo "No database at $DB_PATH — attempting Litestream restore from replica..."
  litestream restore -if-replica-exists -config /app/litestream.yml "$DB_PATH" || true
fi

# Apply committed Drizzle migrations (idempotent; tracked in __drizzle_migrations).
echo "Applying migrations..."
node scripts/migrate.js

# Run the server supervised by Litestream so the SQLite WAL is continuously
# replicated to the bucket. Litestream forwards signals and exits with the child.
echo "Starting server under Litestream replication..."
exec litestream replicate -config /app/litestream.yml \
  -exec "node server/entry.node-server.js"

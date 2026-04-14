#!/usr/bin/env bash
set -euo pipefail

echo "Running post-create steps: install deps, wait for services, run DB seed"

if command -v pnpm >/dev/null 2>&1; then
  PKG_MANAGER="pnpm install"
elif command -v yarn >/dev/null 2>&1; then
  PKG_MANAGER="yarn install"
else
  PKG_MANAGER="npm install"
fi

echo "Installing dependencies..."
eval "$PKG_MANAGER"

wait_for() {
  local host=$1
  local port=$2
  local retries=60
  local i=0
  echo -n "Waiting for $host:$port"
  if command -v nc >/dev/null 2>&1; then
    while ! nc -z "$host" "$port" 2>/dev/null; do
      i=$((i+1))
      if [ "$i" -ge "$retries" ]; then
        echo "\nTimed out waiting for $host:$port"
        return 1
      fi
      echo -n "."
      sleep 1
    done
  else
    while ! curl -sS "http://$host:$port/" >/dev/null 2>&1; do
      i=$((i+1))
      if [ "$i" -ge "$retries" ]; then
        echo "\nTimed out waiting for $host:$port"
        return 1
      fi
      echo -n "."
      sleep 1
    done
  fi
  echo " ok"
}

echo "Waiting for supporting services to be available..."
# Try to use service hostnames (docker compose service names)
wait_for mailpit 8025 || true
wait_for minio 9000 || true
wait_for stripe-mock 12111 || true

echo "Running DB seed (fresh)..."
npm run db:seed || echo "db:seed failed (you can re-run manually)"

echo "Post-create finished. Start the dev server with: npm run dev"

#!/usr/bin/env bash

echo "🚀 Starting post-create setup..."

# 1. Install dependencies (npm handles native builds automatically)
echo "📦 Installing dependencies..."
npm install

# 2. Wait for services
echo "⏳ Waiting for services..."
for service in "mailpit:8025" "minio:9000" "stripe-mock:12111"; do
  host=${service%:*}
  port=${service#*:}
  until curl -s "$host:$port" > /dev/null 2>&1; do
    echo "Waiting for $host..."
    sleep 2
  done
  echo "✅ $host is up!"
done

# 3. Seed Database
echo "🌱 Seeding database..."
npm run db:seed || echo "⚠️ Warning: Seed failed, check logs."

echo "🎉 Done! Run 'npm run dev' to start."
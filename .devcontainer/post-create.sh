#!/usr/bin/env bash

echo "🚀 Starting post-create setup..."

# 1. Install dependencies (npm handles native builds automatically)
echo "📦 Installing dependencies..."
npm install

# 2. Seed Database
echo "🌱 Seeding database..."
npm run db:seed || echo "⚠️ Warning: Seed failed, check logs."

echo "🎉 Done! Run 'npm start' to start."
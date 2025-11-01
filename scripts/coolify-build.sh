#!/bin/bash
set -e

echo "🚀 Coolify Build Script"
echo "Checking if build artifacts exist from CI..."

# Check if .next directories exist (from CI build)
if [ -d "apps/web/.next" ] && [ -d "apps/chrry-dot-dev/.next" ]; then
  echo "✅ Build artifacts found! Skipping build..."
  echo "Using cached build from GitHub Actions CI"
  exit 0
else
  echo "⚠️  No cached build found. Building now..."

  # Install dependencies
  pnpm install --frozen-lockfile

  # Build packages first
  pnpm turbo build --filter="@repo/db" --filter="@chrryai/chrry" --filter="@chrryai/waffles" --filter="@chrryai/pepper"

  # Build apps
  NODE_OPTIONS='--max-old-space-size=8192' CI=true pnpm turbo build --filter="web"
  NODE_OPTIONS='--max-old-space-size=8192' CI=true pnpm turbo build --filter="chrrydotdev"

  echo "✅ Build complete!"
fi

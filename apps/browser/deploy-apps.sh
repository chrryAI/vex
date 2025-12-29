#!/bin/bash

# Deploy Chrry Apps to Production
# This script uploads all signed and notarized DMG installers to your server

set -e  # Exit on error

echo "🚀 Deploying Chrry Apps to Production"
echo "======================================"
echo ""

# Configuration
SERVER="your-server.com"
SERVER_PATH="/var/www/vex.chrry.ai/public/installs"
LOCAL_PATH="../../public/installs"

# Check if DMGs exist
if [ ! -d "$LOCAL_PATH" ]; then
  echo "❌ Error: $LOCAL_PATH directory not found"
  echo "   Run ./build-and-release.sh first"
  exit 1
fi

DMG_COUNT=$(find "$LOCAL_PATH" -name "*.dmg" -type f | wc -l | tr -d ' ')
if [ "$DMG_COUNT" -eq 0 ]; then
  echo "❌ Error: No DMG files found in $LOCAL_PATH"
  exit 1
fi

echo "📦 Found $DMG_COUNT DMG installers"
echo ""

# List files to upload
echo "Files to upload:"
find "$LOCAL_PATH" -name "*.dmg" -type f -exec basename {} \;
echo ""

# Confirm deployment
read -p "Deploy to $SERVER? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

# Upload DMGs
echo ""
echo "📤 Uploading DMGs to server..."

# Option 1: Using rsync (recommended)
rsync -avz --progress "$LOCAL_PATH/*.dmg" "$SERVER:$SERVER_PATH/"

# Option 2: Using scp (uncomment if you prefer)
# scp "$LOCAL_PATH"/*.dmg "$SERVER:$SERVER_PATH/"

# Option 3: Using your cloud storage (uncomment and configure)
# aws s3 sync "$LOCAL_PATH" s3://your-bucket/installs/ --exclude "*" --include "*.dmg"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Apps available at:"
echo "   https://vex.chrry.ai/installs/Atlas.dmg"
echo "   https://vex.chrry.ai/installs/Focus.dmg"
echo "   https://vex.chrry.ai/installs/Vex.dmg"
echo "   https://vex.chrry.ai/installs/Popcorn.dmg"
echo "   https://vex.chrry.ai/installs/Chrry.dmg"
echo "   https://vex.chrry.ai/installs/Zarathustra.dmg"
echo "   https://vex.chrry.ai/installs/Search.dmg"
echo "   https://vex.chrry.ai/installs/Grape.dmg"
echo "   https://vex.chrry.ai/installs/Burn.dmg"
echo ""
echo "🎉 Ready to announce!"

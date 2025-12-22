#!/bin/bash

# Create MinIO Buckets Script
# This script creates the required S3 buckets in MinIO

set -e

echo "🪣 Creating MinIO Buckets"
echo "========================"
echo ""

# MinIO credentials from your .env
MINIO_ENDPOINT="https://minio.chrry.dev"
MINIO_ACCESS_KEY="Qt2M5Y64VVKnlFWm"
MINIO_SECRET_KEY="vGnj8rlu8ra1qDbu7egoW1WLR2PCfBw8"

# Buckets to create
BUCKET_CHAT="chrry-chat-files"
BUCKET_APPS="chrry-app-profiles"

echo "📍 MinIO Endpoint: $MINIO_ENDPOINT"
echo "🪣 Buckets to create:"
echo "   - $BUCKET_CHAT"
echo "   - $BUCKET_APPS"
echo ""

# Install mc (MinIO Client) if not present
if ! command -v mc &> /dev/null; then
    echo "📦 Installing MinIO Client (mc)..."
    wget https://dl.min.io/client/mc/release/linux-amd64/mc
    chmod +x mc
    sudo mv mc /usr/local/bin/
    echo "✅ MinIO Client installed"
else
    echo "✅ MinIO Client already installed"
fi
echo ""

# Configure MinIO alias
echo "🔧 Configuring MinIO connection..."
mc alias set myminio $MINIO_ENDPOINT $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
echo "✅ MinIO connection configured"
echo ""

# Create buckets
echo "🪣 Creating bucket: $BUCKET_CHAT..."
if mc mb myminio/$BUCKET_CHAT 2>/dev/null; then
    echo "✅ Bucket created: $BUCKET_CHAT"
else
    echo "ℹ️  Bucket already exists: $BUCKET_CHAT"
fi

echo "🪣 Creating bucket: $BUCKET_APPS..."
if mc mb myminio/$BUCKET_APPS 2>/dev/null; then
    echo "✅ Bucket created: $BUCKET_APPS"
else
    echo "ℹ️  Bucket already exists: $BUCKET_APPS"
fi
echo ""

# Set public read policy
echo "🔓 Setting public read policy for buckets..."
mc anonymous set download myminio/$BUCKET_CHAT
mc anonymous set download myminio/$BUCKET_APPS
echo "✅ Buckets are now publicly readable"
echo ""

# List buckets to verify
echo "📋 Listing all buckets:"
mc ls myminio/
echo ""

echo "✨ Done! Buckets are ready to use."
echo ""
echo "🧪 Test upload:"
echo "   echo 'test' > test.txt"
echo "   mc cp test.txt myminio/$BUCKET_CHAT/"
echo "   curl $MINIO_ENDPOINT/$BUCKET_CHAT/test.txt"

#!/bin/bash

# MinIO S3 Setup Script for Coolify
# This script helps you configure S3 storage using your existing Coolify MinIO deployment

echo "🚀 MinIO S3 Configuration Helper"
echo "================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create a .env file first (you can copy from .env.example)"
    exit 1
fi

# Check if MinIO variables are set
if [ -z "$MINIO_SERVER_URL" ] || [ -z "$MINIO_ROOT_USER" ] || [ -z "$MINIO_ROOT_PASSWORD" ]; then
    echo "⚠️  MinIO environment variables not found!"
    echo ""
    echo "Please add these from your Coolify MinIO deployment:"
    echo "  MINIO_SERVER_URL=https://minio.your-domain.com"
    echo "  MINIO_ROOT_USER=your-minio-user"
    echo "  MINIO_ROOT_PASSWORD=your-minio-password"
    echo ""
    exit 1
fi

echo "✅ Found MinIO credentials!"
echo "   Server: $MINIO_SERVER_URL"
echo "   User: $MINIO_ROOT_USER"
echo ""

# Add S3 variables to .env if they don't exist
if ! grep -q "S3_ENDPOINT" .env; then
    echo "📝 Adding S3 configuration to .env..."
    cat >> .env << EOF

# S3 Storage (MinIO via Coolify)
S3_ENDPOINT=$MINIO_SERVER_URL
S3_REGION=us-east-1
S3_BUCKET_NAME=chrry-chat-files
S3_BUCKET_NAME_APPS=chrry-app-profiles
S3_ACCESS_KEY_ID=$MINIO_ROOT_USER
S3_SECRET_ACCESS_KEY=$MINIO_ROOT_PASSWORD
S3_PUBLIC_URL=$MINIO_SERVER_URL
EOF
    echo "✅ S3 configuration added to .env"
else
    echo "ℹ️  S3 configuration already exists in .env"
fi

echo ""
echo "🪣 Next Steps:"
echo "1. Open MinIO Console: $MINIO_BROWSER_REDIRECT_URL"
echo "2. Login with:"
echo "   Username: $MINIO_ROOT_USER"
echo "   Password: $MINIO_ROOT_PASSWORD"
echo "3. Create two buckets:"
echo "   - chrry-chat-files"
echo "   - chrry-app-profiles"
echo "4. Set bucket policies to public-read (or use signed URLs)"
echo "5. Restart your application: pnpm run dev"
echo ""
echo "✨ Done! Your app will now use S3 storage instead of UploadThing."

#!/bin/bash

# MinIO Nginx Setup Script
# This script configures nginx for minio.chrry.dev with SSL

set -e

echo "🚀 MinIO Nginx Setup for minio.chrry.dev"
echo "=========================================="
echo ""

# Check if running as root
if [[ "$EUID" -ne 0 ]]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Step 1: Find MinIO ports
echo "📍 Step 1: Detecting MinIO ports..."
MINIO_API_PORT=$(docker ps --filter "name=minio" --format "{{.Ports}}" | grep -oP '\d+(?=->9000)' | head -1)
MINIO_CONSOLE_PORT=$(docker ps --filter "name=minio" --format "{{.Ports}}" | grep -oP '\d+(?=->9001)' | head -1)

if [ -z "$MINIO_API_PORT" ]; then
    echo "⚠️  Could not auto-detect MinIO API port. Using default 9000"
    MINIO_API_PORT=9000
fi

if [ -z "$MINIO_CONSOLE_PORT" ]; then
    echo "⚠️  Could not auto-detect MinIO Console port. Using default 9001"
    MINIO_CONSOLE_PORT=9001
fi

echo "   MinIO API Port: $MINIO_API_PORT"
echo "   MinIO Console Port: $MINIO_CONSOLE_PORT"
echo ""

# Step 2: Create nginx config
echo "📝 Step 2: Creating nginx configuration..."
cat > /etc/nginx/sites-available/minio.chrry.dev << EOF
# MinIO Nginx Configuration
upstream minio_backend {
    server 127.0.0.1:$MINIO_API_PORT;
}

upstream minio_console {
    server 127.0.0.1:$MINIO_CONSOLE_PORT;
}

# MinIO API - minio.chrry.dev
server {
    listen 80;
    listen [::]:80;
    server_name minio.chrry.dev;

    client_max_body_size 1000M;
    client_body_timeout 300s;
    proxy_buffering off;
    proxy_request_buffering off;

    location / {
        proxy_pass http://minio_backend;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}

# MinIO Console - console.minio.chrry.dev
server {
    listen 80;
    listen [::]:80;
    server_name console.minio.chrry.dev;

    client_max_body_size 100M;

    location / {
        proxy_pass http://minio_console;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

echo "✅ Config created: /etc/nginx/sites-available/minio.chrry.dev"
echo ""

# Step 3: Enable site
echo "🔗 Step 3: Enabling site..."
ln -sf /etc/nginx/sites-available/minio.chrry.dev /etc/nginx/sites-enabled/
echo "✅ Site enabled"
echo ""

# Step 4: Test nginx config
echo "🧪 Step 4: Testing nginx configuration..."
if nginx -t; then
    echo "✅ Nginx config is valid"
else
    echo "❌ Nginx config has errors. Please fix before continuing."
    exit 1
fi
echo ""

# Step 5: Reload nginx
echo "🔄 Step 5: Reloading nginx..."
systemctl reload nginx
echo "✅ Nginx reloaded"
echo ""

# Step 6: Install certbot if not present
echo "🔐 Step 6: Checking for certbot..."
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
    echo "✅ Certbot installed"
else
    echo "✅ Certbot already installed"
fi
echo ""

# Step 7: Get SSL certificate
echo "🔒 Step 7: Obtaining SSL certificate..."
echo "   This will request certificates for:"
echo "   - minio.chrry.dev"
echo "   - console.minio.chrry.dev"
echo ""
read -p "Continue with SSL setup? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    certbot --nginx -d minio.chrry.dev -d console.minio.chrry.dev --non-interactive --agree-tos --email admin@chrry.dev
    echo "✅ SSL certificates obtained and configured"
else
    echo "⏭️  Skipping SSL setup. You can run this later with:"
    echo "   certbot --nginx -d minio.chrry.dev -d console.minio.chrry.dev"
fi
echo ""

echo "✨ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Add DNS records in Cloudflare:"
echo "   - minio.chrry.dev → A record → 162.55.97.114"
echo "   - console.minio.chrry.dev → A record → 162.55.97.114"
echo ""
echo "2. Update your .env file:"
echo "   S3_ENDPOINT=https://minio.chrry.dev"
echo "   S3_PUBLIC_URL=https://minio.chrry.dev"
echo ""
echo "3. Test the setup:"
echo "   curl http://minio.chrry.dev/minio/health/live"
echo ""
echo "🎉 Done!"

# MinIO Console Setup for Coolify

MinIO Console provides a web UI to manage your MinIO object storage - browse buckets, upload files, manage users/policies, etc.

## Prerequisites

1. **MinIO Server** already running on Coolify (you have this ✅)
2. **Subdomain** for Console: `console.chrry.dev` (or `minio-console.chrry.dev`)
3. **Cloudflare DNS** A record pointing to your VPS IP

## Setup Steps

### 1. Cloudflare DNS Configuration

Add an A record in Cloudflare:

```
Type: A
Name: console (or minio-console)
Content: YOUR_VPS_IP
Proxy: ✅ Proxied (orange cloud)
TTL: Auto
```

### 2. Generate Secrets

Generate random secrets for JWT encryption:

```bash
# Generate PBKDF passphrase (32 chars)
openssl rand -base64 32

# Generate PBKDF salt (32 chars)
openssl rand -base64 32
```

Save these values - you'll need them for environment variables.

### 3. Coolify Deployment

#### Option A: Docker Compose (Recommended)

1. In Coolify, create a new **Docker Compose** service
2. Copy contents from `docker-compose.minio-console.yml`
3. Set environment variables:

```env
# MinIO Connection
MINIO_SERVER_URL=https://minio.chrry.dev
MINIO_ROOT_USER=your_minio_admin_user
MINIO_ROOT_PASSWORD=your_minio_admin_password

# JWT Secrets (from step 2)
CONSOLE_PBKDF_PASSPHRASE=your_generated_passphrase
CONSOLE_PBKDF_SALT=your_generated_salt
```

4. Set domain: `console.chrry.dev`
5. Deploy!

#### Option B: Simple Docker Service

1. In Coolify, create a new **Docker** service
2. Image: `minio/console:latest`
3. Port: `9001`
4. Domain: `console.chrry.dev`
5. Environment variables (same as above)

### 4. Access Console

1. Navigate to `https://console.chrry.dev`
2. Login with your MinIO credentials:
   - **Access Key**: `MINIO_ROOT_USER`
   - **Secret Key**: `MINIO_ROOT_PASSWORD`

## Features

✅ **Browse Buckets**: View all buckets and objects  
✅ **Upload Files**: Drag-and-drop file uploads  
✅ **User Management**: Create users, assign policies  
✅ **Policy Management**: Create custom access policies  
✅ **Monitoring**: View storage usage, metrics  
✅ **Bucket Settings**: Configure versioning, lifecycle, encryption

## Security Notes

⚠️ **Important**:

- Don't use MinIO root credentials for your app - create separate users with limited permissions
- Console should only be accessible by admins
- Consider adding IP whitelist or VPN access for production

## Creating App-Specific Users (Recommended)

Instead of using root credentials in your app, create a dedicated user:

```bash
# Install mc (MinIO Client)
brew install minio/stable/mc

# Configure mc
mc alias set myminio https://minio.chrry.dev MINIO_ROOT_USER MINIO_ROOT_PASSWORD

# Create app user
mc admin user add myminio vex-app YOUR_SECURE_PASSWORD

# Create policy for app (read/write to specific buckets)
cat > vex-app-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::chrry-chat-files/*",
        "arn:aws:s3:::chrry-app-profiles/*"
      ]
    }
  ]
}
EOF

# Apply policy
mc admin policy create myminio vex-app-policy vex-app-policy.json
mc admin policy attach myminio vex-app-policy --user=vex-app

# Update your .env
S3_ACCESS_KEY_ID=vex-app
S3_SECRET_ACCESS_KEY=YOUR_SECURE_PASSWORD
```

## Troubleshooting

### Console can't connect to MinIO

Check:

- MinIO Server URL is correct and accessible
- MinIO credentials are valid
- Network connectivity between Console and MinIO containers

### SSL/TLS errors

If MinIO uses self-signed certificate:

```env
CONSOLE_MINIO_SERVER_TLS_SKIP_VERIFICATION=on
```

### Can't login

- Verify credentials match MinIO root user
- Check Console logs in Coolify
- Ensure JWT secrets are set correctly

## Resource Usage

- **Memory**: ~50-100 MB
- **CPU**: Minimal (UI only, no heavy processing)
- **Storage**: Negligible (no data stored, just UI)

## Alternative: mc CLI

If you prefer CLI over web UI:

```bash
# List buckets
mc ls myminio

# Upload file
mc cp file.png myminio/chrry-chat-files/

# Download file
mc cp myminio/chrry-chat-files/file.png ./

# Remove file
mc rm myminio/chrry-chat-files/file.png
```

---

**Recommendation**: Start with Console for visual management, then use `mc` CLI for automation/scripts.

# Deployment Guide for Hetzner/Coolify

## Overview

You have **2 applications** to deploy:

1. **Web App (focus.chrry.ai)** - Port 3000
2. **API (chrry-dot-dev)** - Port 3001

---

## 🌐 Service 1: Web App (focus.chrry.ai)

### Coolify Configuration

**General:**

- **Name:** `focus-chrry-ai`
- **Repository:** `chrryAI/vex`
- **Branch:** `main`
- **Base Directory:** `/` (root)
- **Build Pack:** `nixpacks`
- **Port:** `3000`

**Environment Variables:**

```bash
NODE_ENV=production
NEXT_PUBLIC_SITE_MODE=focus
NEXTAUTH_URL=https://focus.chrry.ai
NEXTAUTH_SECRET=<generate-secret>
PORT=3000

# Database
DB_URL=postgresql://user:password@host:5432/dbname

# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
DEEPSEEK_API_KEY=...

# UploadThing
UPLOADTHING_SECRET=...
UPLOADTHING_APP_ID=...

# Redis/Upstash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Sentry (optional)
SENTRY_DSN=...
SENTRY_AUTH_TOKEN=...
```

**Domain:**

- Add domain: `focus.chrry.ai`
- Enable SSL (Let's Encrypt)

**Build Config:**

- Uses root `nixpacks.toml`
- Builds with: `pnpm --filter web build`
- Starts with: `pnpm --filter web start`

---

## 🔌 Service 2: API (chrry-dot-dev)

### Coolify Configuration

**General:**

- **Name:** `chrry-dot-dev-api`
- **Repository:** `chrryAI/vex`
- **Branch:** `main`
- **Base Directory:** `apps/chrry-dot-dev`
- **Build Pack:** `nixpacks`
- **Port:** `3001`

**Environment Variables:**

```bash
NODE_ENV=production
NEXTAUTH_URL=https://api.chrry.ai
NEXTAUTH_SECRET=<same-as-web>
PORT=3001

# Database (same as web)
DB_URL=postgresql://user:password@host:5432/dbname

# API Keys (same as web)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
DEEPSEEK_API_KEY=...

# UploadThing (same as web)
UPLOADTHING_SECRET=...
UPLOADTHING_APP_ID=...

# Redis/Upstash (same as web)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Stripe (same as web)
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

**Domain:**

- Add domain: `api.chrry.ai` (or use subdomain)
- Enable SSL (Let's Encrypt)

**Build Config:**

- Uses `apps/chrry-dot-dev/.nixpacks.toml`
- Builds with: `pnpm --filter chrrydotdev build`
- Starts with: `pnpm --filter chrrydotdev start`

---

## 📝 Current Nixpacks Configs

### Root `nixpacks.toml` (for Web)

```toml
[phases.setup]
nixPkgs = ["nodejs_22", "ffmpeg"]
nixLibs = []

[phases.install]
cmds = ["corepack enable", "corepack prepare pnpm@9.1.2 --activate", "pnpm install --frozen-lockfile"]

[phases.build]
cmds = ["pnpm --filter web build"]

[start]
cmd = "pnpm --filter web start"
```

### `apps/chrry-dot-dev/.nixpacks.toml` (for API)

```toml
[phases.setup]
nixPkgs = ["nodejs_22"]
nixLibs = []

[phases.install]
cmds = ["corepack enable", "corepack prepare pnpm@9.1.2 --activate", "pnpm install --frozen-lockfile"]

[phases.build]
cmds = ["pnpm --filter chrrydotdev build"]

[start]
cmd = "pnpm --filter chrrydotdev start"
```

### `apps/web/.nixpacks.toml` (alternative for Web)

```toml
[phases.setup]
nixPkgs = ["nodejs_22"]
nixLibs = []

[phases.install]
cmds = ["corepack enable", "corepack prepare pnpm@9.1.2 --activate", "pnpm install --frozen-lockfile"]

[phases.build]
cmds = ["pnpm --filter web build"]

[start]
cmd = "pnpm --filter web start"
```

---

## 🚀 Deployment Steps

### 1. Push Changes

```bash
git add .
git commit -m "🔧 Fix Coolify deployment configs"
git push
```

### 2. In Coolify Dashboard

#### Create Web Service:

1. **+ New Resource** → **Application**
2. Select GitHub repo `chrryAI/vex`
3. Branch: `main`
4. Base Directory: `/` (root)
5. Port: `3000`
6. Add environment variables
7. Add domain: `focus.chrry.ai`
8. **Deploy**

#### Create API Service:

1. **+ New Resource** → **Application**
2. Select GitHub repo `chrryAI/vex`
3. Branch: `main`
4. Base Directory: `apps/chrry-dot-dev`
5. Port: `3001`
6. Add environment variables
7. Add domain: `api.chrry.ai`
8. **Deploy**

### 3. DNS Configuration

Point these domains to your Hetzner server IP:

```
A    focus.chrry.ai    →  YOUR_SERVER_IP
A    api.chrry.ai      →  YOUR_SERVER_IP
```

### 4. Enable SSL

Coolify will automatically provision Let's Encrypt SSL certificates once DNS is configured.

---

## 🔍 Troubleshooting

### "Missing script start or file server.js"

**Cause:** Coolify is running from wrong directory or using wrong config

**Fix:**

- Check **Base Directory** setting in Coolify
- For Web: Use root `/` or leave empty
- For API: Use `apps/chrry-dot-dev`
- Verify nixpacks.toml has correct `--filter` commands

### Build Fails

**Check:**

1. Environment variables are set
2. Database connection string is correct
3. All API keys are valid
4. Build logs in Coolify for specific errors

### Port Conflicts

- Web runs on port 3000
- API runs on port 3001
- Make sure no other services use these ports

---

## 📊 Monitoring

After deployment, check:

1. **Web:** https://focus.chrry.ai
2. **API:** https://api.chrry.ai/health
3. **Logs:** Coolify dashboard → Service → Logs

---

## 🔐 Security Checklist

- [ ] SSL certificates enabled
- [ ] Environment variables secured
- [ ] Database credentials rotated
- [ ] API keys restricted
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Firewall rules set
- [ ] Backups configured

---

## 📞 Support

If issues persist:

1. Check Coolify build logs
2. Check application logs
3. Verify DNS propagation
4. Test locally with same env vars

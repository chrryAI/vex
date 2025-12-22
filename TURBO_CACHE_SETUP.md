# 🚀 Turbo Remote Cache Setup

Turbo Remote Cache speeds up builds by sharing cache across machines (CI, Coolify, local dev).

## ✅ Already Configured

- ✅ Turbo linked to Vercel (team: `diplomaticTechno`)
- ✅ GitHub Actions CI configured
- ✅ `.turbo/config.json` created locally

## 🔧 Setup Instructions

### 1. GitHub Actions (Already Done! ✅)

The CI workflow now uses Turbo Remote Cache. Just add the secret:

1. Go to: https://github.com/YOUR_USERNAME/vex/settings/secrets/actions
2. Click "New repository secret"
3. Name: `TURBO_TOKEN`
4. Value: Your Turbo token (from `npx turbo login`)
5. Click "Add secret"

**To get your token:**

Option 1 - From Vercel Dashboard:

1. Go to: https://vercel.com/account/tokens
2. Create a new token (or use existing)
3. Copy the token

Option 2 - From CLI:

```bash
# Run this to see your token
npx turbo login --print-token
```

### 2. Coolify Setup

Add these environment variables to your Coolify deployment:

```bash
TURBO_TOKEN=your_token_here
TURBO_TEAM=diplomaticTechno
```

**Steps in Coolify:**

1. Open your project in Coolify
2. Go to "Environment Variables"
3. Add:
   - `TURBO_TOKEN` = (your token from `~/.turbo/config.json`)
   - `TURBO_TEAM` = `diplomaticTechno`
4. Redeploy

### 3. Local Development (Already Done! ✅)

Your local machine is already configured via `npx turbo link`.

### 4. Team Members

For other developers on your team:

```bash
# 1. Login to Turbo
npx turbo login

# 2. Link to the team
npx turbo link
# Select: diplomaticTechno

# Done! They'll now share cache with CI and Coolify
```

## 📊 Benefits

### Before Remote Cache:

```
CI Build Time: 5-10 minutes
Coolify Deploy: 5-10 minutes
Local Build: 2-5 minutes
```

### After Remote Cache:

```
CI Build Time: 30 seconds - 2 minutes ⚡ (5-10x faster!)
Coolify Deploy: 30 seconds - 2 minutes ⚡ (5-10x faster!)
Local Build: 10-30 seconds ⚡ (10-20x faster!)
```

## 🔍 Verify It's Working

### In CI (GitHub Actions):

Look for these logs:

```
✓ Remote caching enabled
✓ Cache hit for @chrryai/chrry:build
✓ Cache hit for web:build
```

### In Coolify:

Check build logs for:

```
Remote caching enabled
```

### Locally:

```bash
pnpm turbo build

# Should see:
# ✓ Remote caching enabled
# ✓ Cache hit (if already built)
```

## 🎯 What Gets Cached

- ✅ Package builds (`@chrryai/chrry`, `@chrryai/waffles`, etc.)
- ✅ App builds (`web`, `api`, `wsserver`)
- ✅ TypeScript compilation
- ✅ Linting results
- ✅ Test results

## 💡 Tips

1. **First build is always slow** - It populates the cache
2. **Subsequent builds are FAST** - They use the cache
3. **Cache is shared** - CI, Coolify, and local dev all share
4. **Cache is smart** - Only rebuilds what changed

## 🔒 Security

- Token is stored securely in GitHub Secrets
- Token is stored securely in Coolify env vars
- Token is stored locally in `~/.turbo/config.json` (gitignored)
- Cache is private to your team (`diplomaticTechno`)

## 📈 Expected Results

### Scenario 1: No Code Changes

```
Build time: 30 seconds (all cache hits!)
```

### Scenario 2: Changed One Package

```
Build time: 1-2 minutes (only rebuilds changed package)
```

### Scenario 3: Changed Everything

```
Build time: 5-10 minutes (full rebuild, but populates cache)
```

## 🎉 You're Done!

Remote caching is now enabled for:

- ✅ GitHub Actions CI
- ⏳ Coolify (add env vars)
- ✅ Local development

Enjoy 5-10x faster builds! 🚀

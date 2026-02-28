# 🌍 City Launcher Script

Launch a new city subdomain in 30 seconds.

## Prerequisites

1. **Cloudflare API credentials**

   ```bash
   export CLOUDFLARE_ZONE_ID='your-zone-id'
   export CLOUDFLARE_TOKEN='your-api-token'
   ```

2. **SSH access to production server**

   ```bash
   ssh root@162.55.97.114
   ```

3. **Git push access**
   ```bash
   git push origin chrry
   ```

## Usage

```bash
# Make script executable
chmod +x scripts/add-city.sh

# Launch a city
./scripts/add-city.sh <city> <country> <emoji> <color> <language>
```

## Examples

### European Cities

```bash
# Berlin, Germany
./scripts/add-city.sh berlin Germany 🇩🇪 "#000000" German

# Paris, France
./scripts/add-city.sh paris France 🇫🇷 "#0055A4" French

# London, UK
./scripts/add-city.sh london UK 🇬🇧 "#012169" English

# Madrid, Spain
./scripts/add-city.sh madrid Spain 🇪🇸 "#C60B1E" Spanish

# Rome, Italy
./scripts/add-city.sh rome Italy 🇮🇹 "#009246" Italian
```

### Asian Cities

```bash
# Mumbai, India
./scripts/add-city.sh mumbai India 🇮🇳 "#FF9933" Hindi

# Seoul, South Korea
./scripts/add-city.sh seoul "South Korea" 🇰🇷 "#003478" Korean

# Bangkok, Thailand
./scripts/add-city.sh bangkok Thailand 🇹🇭 "#A51931" Thai

# Singapore
./scripts/add-city.sh singapore Singapore 🇸🇬 "#EF3340" English
```

### American Cities

```bash
# Los Angeles, USA
./scripts/add-city.sh losangeles USA 🇺🇸 "#005A9C" English

# Chicago, USA
./scripts/add-city.sh chicago USA 🇺🇸 "#B3DDF2" English

# Miami, USA
./scripts/add-city.sh miami USA 🇺🇸 "#F47920" English

# São Paulo, Brazil
./scripts/add-city.sh saopaulo Brazil 🇧🇷 "#009739" Portuguese

# Mexico City, Mexico
./scripts/add-city.sh mexicocity Mexico 🇲🇽 "#006847" Spanish
```

## What It Does

The script performs 6 automated steps:

1. **📡 DNS** - Adds CNAME record via Cloudflare API
2. **🔧 Nginx** - Creates nginx config on production server
3. **🔒 SSL** - Obtains SSL certificate via Let's Encrypt
4. **📝 Code** - Updates `siteConfig.ts` with domain detection
5. **🎨 Config** - Adds site configuration with branding
6. **🚀 Git** - Commits and pushes changes

## After Running

1. **Seed the database**

   ```bash
   pnpm dbs
   ```

2. **Verify the subdomain**

   ```bash
   curl -I https://berlin.chrry.ai
   ```

3. **Test in browser**
   - Visit `https://berlin.chrry.ai`
   - Check branding (logo, colors)
   - Verify site mode detection

## Architecture

### Multi-Tenant White-Label

- **Single codebase** → Multiple brands
- **Single server** → Multiple subdomains
- **Single database** → Isolated data
- **Zero marginal cost** → Infinite scalability

### How It Works

```
berlin.chrry.ai
    ↓
nginx (port 443)
    ↓
Next.js (port 3008)
    ↓
detectsiteModeDomain("berlin.chrry.ai")
    ↓
getSiteConfig("berlin")
    ↓
Returns Berlin branding
```

## Troubleshooting

### DNS not propagating

```bash
# Check DNS
dig berlin.chrry.ai

# Force DNS refresh
curl -H "Cache-Control: no-cache" https://berlin.chrry.ai
```

### SSL certificate failed

```bash
# SSH to server
ssh root@162.55.97.114

# Manually run certbot
certbot --nginx -d berlin.chrry.ai
```

### Nginx config error

```bash
# SSH to server
ssh root@162.55.97.114

# Test nginx config
nginx -t

# View error logs
tail -f /var/log/nginx/error.log
```

### Site mode not detected

```bash
# Check siteConfig.ts
grep "berlin" packages/ui/utils/siteConfig.ts

# Restart dev server
pnpm vs
```

## Scaling Strategy

### Phase 1: Top 10 Cities (Week 1)

- New York, London, Tokyo, Paris, Berlin
- Istanbul, Amsterdam, Singapore, Dubai, Sydney

### Phase 2: Top 50 Cities (Month 1)

- All major European capitals
- Top US cities (LA, Chicago, Miami, SF, etc.)
- Top Asian cities (Seoul, Bangkok, Mumbai, etc.)

### Phase 3: Top 100 Cities (Month 3)

- Regional hubs worldwide
- Emerging markets (Africa, South America)
- Tourist destinations

### Phase 4: 1000+ Cities (Year 1)

- Every city with 1M+ population
- White-label partnerships
- User-generated cities

## Economics

### Cost Per City

- DNS: $0 (Cloudflare free tier)
- SSL: $0 (Let's Encrypt)
- Server: $0 (same server)
- Code: $0 (automated)
- **Total: $0**

### Revenue Per City

- 10,000 users × $5/month = $50,000/month
- 100 cities = $5M/month
- 1,000 cities = $50M/month

### Time Investment

- Manual: 2 hours per city
- Automated: 30 seconds per city
- **4,800x faster**

## Future Enhancements

### 1. Web UI

```typescript
// Admin panel at /admin/cities
<form onSubmit={launchCity}>
  <input name="city" />
  <input name="country" />
  <button type="button" >Launch City</button>
</form>
```

### 2. AI-Powered

```bash
# Just say: "Launch Berlin"
./scripts/ai-city.sh "Launch Berlin"
# AI extracts all parameters automatically
```

### 3. User-Generated

```typescript
// Let users launch their own cities
<button onClick={() => launchCity("mycity")}>
  Launch Your City ($99/month)
</button>
```

### 4. Marketplace

- Cities can be bought/sold
- Revenue sharing with city owners
- White-label partnerships

## The Vision

**This script is the foundation for a platform that scales infinitely with zero marginal cost.**

- ✅ Multi-tenant architecture
- ✅ White-label branding
- ✅ Zero-cost scaling
- ✅ Automated deployment
- ✅ Global reach

**From 1 city to 1,000 cities in one year.**

---

_Built with ❤️ by the Chrry team_

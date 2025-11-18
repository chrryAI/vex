# Zero Server

Real-time sync server for Vex using [Zero by Replicache](https://zero.rocicorp.dev/) + [drizzle-zero](https://github.com/0xcadams/drizzle-zero).

## What is This?

Zero eliminates the need for REST/GraphQL APIs by syncing data directly from PostgreSQL to the client via WebSockets. This server:

- ✅ **Auto-generates Zero schemas from your existing Drizzle schemas** (no manual schema definition!)
- ✅ Syncs database changes to clients in real-time
- ✅ Handles authentication and authorization
- ✅ Manages WebSocket connections
- ✅ Provides automatic caching via IndexedDB
- ✅ Enables optimistic updates

## How It Works

```
Drizzle Schema (packages/db)
         ↓
   drizzle-zero CLI
         ↓
  Zero Schema (auto-generated)
         ↓
   Zero Server (this app)
         ↓
  WebSocket → Client
```

**You never write Zero schemas manually!** They're auto-generated from your Drizzle schemas.

## Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your database URL
# DATABASE_URL=postgresql://...

# Generate Zero schema from Drizzle
npm run generate

# Start development server (auto-generates schema first)
npm run dev
```

Server will run on `http://localhost:4848`

### Schema Generation

The Zero schema is **automatically generated** from your Drizzle schema:

1. Edit `drizzle-zero.config.ts` to specify which tables/columns to sync
2. Run `npm run generate` to create `zero-schema.gen.ts`
3. The server imports this auto-generated schema

**You never manually write Zero schemas!**

## Production Deployment (Hetzner)

### 1. Create Hetzner VPS

```bash
# SSH into your Hetzner server
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install docker-compose -y
```

### 2. Deploy with Docker

```bash
# Clone repo (or copy files)
git clone https://github.com/chrryAI/vex.git
cd vex/apps/zero-server

# Create .env file
nano .env
# Add:
# DATABASE_URL=postgresql://user:pass@host:5432/vex
# ZERO_PORT=4848
# ZERO_AUTH_SECRET=your-secret-key
# ALLOWED_ORIGINS=https://chrry.ai,https://*.chrry.ai

# Build and run
docker build -t vex-zero-server .
docker run -d \
  --name zero-server \
  --restart unless-stopped \
  -p 4848:4848 \
  --env-file .env \
  vex-zero-server

# Check logs
docker logs -f zero-server
```

### 3. Configure DNS

Point `zero.chrry.dev` to your Hetzner server IP:

```
A record: zero.chrry.dev → your-server-ip
```

### 4. Set Up Nginx (Optional, for HTTPS)

```nginx
# /etc/nginx/sites-available/zero.chrry.dev
server {
    listen 80;
    server_name zero.chrry.dev;

    location / {
        proxy_pass http://localhost:4848;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/zero.chrry.dev /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Get SSL certificate
certbot --nginx -d zero.chrry.dev
```

### 5. Verify Deployment

```bash
# Check server is running
curl http://zero.chrry.dev/health

# Check WebSocket connection
wscat -c wss://zero.chrry.dev
```

## Architecture

```
┌─────────┐   WebSocket   ┌──────────┐     SQL      ┌──────────┐
│ Client  │ <══════════> │ Zero     │ ──────────> │ Postgres │
│ (React) │   (Sync)      │ Server   │              │          │
└─────────┘               └──────────┘              └──────────┘
     │
     └─> IndexedDB (local cache)
```

## Client Usage

```typescript
import { Zero } from "@rocicorp/zero"

// Initialize Zero client
const zero = new Zero({
  server: "wss://zero.chrry.dev",
  auth: () => getAuthToken(),
})

// Query messages (syncs automatically)
const [messages] = useQuery(
  zero.query.message
    .where("threadId", threadId)
    .related("sender")
    .orderBy("createdAt", "desc")
)

// Messages update automatically when anyone sends a message!
// No API routes needed!
// No manual cache invalidation!
```

## Monitoring

```bash
# View logs
docker logs -f zero-server

# Check resource usage
docker stats zero-server

# Restart server
docker restart zero-server
```

## Scaling

For high traffic, consider:

1. **Horizontal scaling**: Multiple Zero servers behind load balancer
2. **Database read replicas**: For read-heavy workloads
3. **Redis for session storage**: Share sessions across servers
4. **CDN for static assets**: Reduce server load

## Cost Estimate

**Hetzner VPS:**
- CX11 (2GB RAM, 1 vCPU): €4.15/month
- CX21 (4GB RAM, 2 vCPU): €5.83/month
- CX31 (8GB RAM, 2 vCPU): €10.59/month

**Recommended:** CX21 for production (~€6/month)

## Troubleshooting

### WebSocket connection fails

```bash
# Check if server is running
docker ps | grep zero-server

# Check logs for errors
docker logs zero-server

# Verify firewall allows port 4848
ufw allow 4848
```

### Database connection issues

```bash
# Test database connection
docker exec -it zero-server node -e "
  const postgres = require('postgres');
  const sql = postgres(process.env.DATABASE_URL);
  sql\`SELECT 1\`.then(() => console.log('✅ Connected')).catch(console.error);
"
```

### High memory usage

```bash
# Check memory
docker stats zero-server

# Restart if needed
docker restart zero-server

# Consider upgrading VPS
```

## Resources

- [Zero Documentation](https://zero.rocicorp.dev/)
- [Zero GitHub](https://github.com/rocicorp/zero)
- [Hetzner Cloud](https://www.hetzner.com/cloud)

## License

MIT

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/flash/package.json apps/flash/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
COPY packages/pepper/package.json packages/pepper/

# Install ALL dependencies (including devDependencies needed for build)
RUN pnpm install --frozen-lockfile

# Build the source code
FROM base AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy node_modules from deps stage (REUSE, don't reinstall!)
# Copy root node_modules
COPY --from=deps /app/node_modules ./node_modules
# Copy workspace node_modules
COPY --from=deps /app/apps/flash/node_modules ./apps/flash/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/pepper/node_modules ./packages/pepper/node_modules
COPY --from=deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# Copy source code
COPY . .

# Build the Vite application
ENV NODE_OPTIONS='--max-old-space-size=8192'
RUN pnpm --filter flash run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 viteuser

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy package files
COPY --chown=viteuser:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=viteuser:nodejs apps/flash/package.json apps/flash/
COPY --chown=viteuser:nodejs packages/db/package.json packages/db/
COPY --chown=viteuser:nodejs packages/ui/package.json packages/ui/
COPY --chown=viteuser:nodejs packages/pepper/package.json packages/pepper/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --chown=viteuser:nodejs --from=builder /app/apps/flash/dist ./apps/flash/dist
COPY --chown=viteuser:nodejs --from=builder /app/apps/flash/server.js ./apps/flash/
COPY --chown=viteuser:nodejs --from=builder /app/apps/flash/public ./apps/flash/public
COPY --chown=viteuser:nodejs --from=builder /app/apps/flash/index.html ./apps/flash/
COPY --chown=viteuser:nodejs --from=builder /app/apps/flash/content ./apps/flash/content

# Copy workspace packages
COPY --chown=viteuser:nodejs --from=builder /app/packages ./packages

# Switch to non-root user
USER viteuser

EXPOSE 5173

ENV PORT=5173
ENV HOST="0.0.0.0"

WORKDIR /app/apps/flash

CMD ["node", "server.js"]

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm and vite-plus
RUN npm install -g pnpm@9.15.0 vite-plus@0.1.14

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/agent/package.json apps/agent/
COPY apps/api/package.json apps/api/
COPY apps/bridge/package.json apps/bridge/
COPY apps/desktop/package.json apps/desktop/
COPY apps/extension/package.json apps/extension/
COPY apps/flash/package.json apps/flash/
COPY apps/mobile/package.json apps/mobile/
COPY packages/calendar/package.json packages/calendar/
COPY packages/db/package.json packages/db/
COPY packages/focus/package.json packages/focus/
COPY packages/pepper/package.json packages/pepper/
COPY packages/shared/package.json packages/shared/
COPY packages/sushi/package.json packages/sushi/
COPY packages/sushi/cli/package.json packages/sushi/cli/
COPY packages/sushi/packages/bam/package.json packages/sushi/packages/bam/
COPY packages/sushi/packages/memory/package.json packages/sushi/packages/memory/
COPY packages/sushi/packages/spatial-agents/package.json packages/sushi/packages/spatial-agents/
COPY packages/sushi/packages/strike/package.json packages/sushi/packages/strike/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/ui/package.json packages/ui/
COPY packages/waffles/package.json packages/waffles/
COPY malwareScanner/package.json malwareScanner/

# Install ALL dependencies (including devDependencies needed for build)
RUN pnpm install --frozen-lockfile

# Build the source code
FROM base AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm and vite-plus
RUN npm install -g pnpm@9.15.0 vite-plus@0.1.14

# Copy everything from deps stage (package.json files and node_modules)
COPY --from=deps /app ./

# Copy source code
COPY . .

# Build the Vite application
ENV NODE_OPTIONS='--max-old-space-size=8192'
RUN vp run build --filter flash

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 viteuser

# Install pnpm and vite-plus
RUN npm install -g pnpm@9.15.0 vite-plus@0.1.14

# Copy package files
COPY --chown=viteuser:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=viteuser:nodejs apps/agent/package.json apps/agent/
COPY --chown=viteuser:nodejs apps/api/package.json apps/api/
COPY --chown=viteuser:nodejs apps/bridge/package.json apps/bridge/
COPY --chown=viteuser:nodejs apps/desktop/package.json apps/desktop/
COPY --chown=viteuser:nodejs apps/extension/package.json apps/extension/
COPY --chown=viteuser:nodejs apps/flash/package.json apps/flash/
COPY --chown=viteuser:nodejs apps/mobile/package.json apps/mobile/
COPY --chown=viteuser:nodejs packages/calendar/package.json packages/calendar/
COPY --chown=viteuser:nodejs packages/db/package.json packages/db/
COPY --chown=viteuser:nodejs packages/focus/package.json packages/focus/
COPY --chown=viteuser:nodejs packages/pepper/package.json packages/pepper/
COPY --chown=viteuser:nodejs packages/shared/package.json packages/shared/
COPY --chown=viteuser:nodejs packages/sushi/package.json packages/sushi/
COPY --chown=viteuser:nodejs packages/sushi/cli/package.json packages/sushi/cli/
COPY --chown=viteuser:nodejs packages/sushi/packages/bam/package.json packages/sushi/packages/bam/
COPY --chown=viteuser:nodejs packages/sushi/packages/spatial-agents/package.json packages/sushi/packages/spatial-agents/
COPY --chown=viteuser:nodejs packages/sushi/packages/strike/package.json packages/sushi/packages/strike/
COPY --chown=viteuser:nodejs packages/typescript-config/package.json packages/typescript-config/
COPY --chown=viteuser:nodejs packages/ui/package.json packages/ui/
COPY --chown=viteuser:nodejs packages/waffles/package.json packages/waffles/

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5173/health || exit 1

CMD ["node", "server.js"]

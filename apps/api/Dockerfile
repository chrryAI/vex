FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install pnpm
RUN bun install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN bun install -g pnpm

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build packages if needed (using pnpm)
RUN cd packages/db && pnpm run build || true
RUN cd packages/ui && pnpm run build || true

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user (Debian-style commands for Bun image)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs hono

# Copy necessary files
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Set proper ownership
RUN chown -R hono:nodejs /app

# Switch to non-root user
USER hono

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Run with Bun
CMD ["bun", "run", "apps/api/server.ts"]

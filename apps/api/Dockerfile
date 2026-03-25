FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install dependencies only when needed
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6-dev \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install pnpm and vite-plus
RUN npm install -g pnpm@9.15.0 vite-plus@0.1.14 --ignore-scripts --force

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
COPY packages/sushi/packages/spatial-agents/package.json packages/sushi/packages/spatial-agents/
COPY packages/sushi/packages/strike/package.json packages/sushi/packages/strike/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/ui/package.json packages/ui/
COPY packages/waffles/package.json packages/waffles/
COPY malwareScanner/package.json malwareScanner/

# Install all dependencies (hono is needed at runtime)
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install FFmpeg for video processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs hono

# Copy tsconfig.json and bunfig.toml FIRST for Bun path mappings
COPY --chown=hono:nodejs tsconfig.json ./tsconfig.json
COPY --chown=hono:nodejs bunfig.toml ./bunfig.toml

# Copy the ENTIRE node_modules including workspace structure
COPY --from=deps --chown=hono:nodejs /app ./

# Copy application code (this will overwrite if needed)
COPY --chown=hono:nodejs apps/api ./apps/api
COPY --chown=hono:nodejs packages ./packages

# Copy packages/ui as chrry for direct imports (Docker doesn't follow symlinks)
COPY --chown=hono:nodejs packages/ui ./chrry

# Ensure tsconfig.json is in the root (copy again to be safe)
COPY --chown=hono:nodejs tsconfig.json ./tsconfig.json

# Install Bun for runtime (much faster than Node)
COPY --from=oven/bun:1.1.27 /usr/local/bin/bun /usr/local/bin/bun

# Switch to non-root user
USER hono

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Run with Bun for better performance
CMD ["/usr/local/bin/bun", "run", "apps/api/server.ts"]

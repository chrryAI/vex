FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy only package files for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/agent/package.json ./apps/agent/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/bridge/package.json ./apps/bridge/package.json
COPY apps/desktop/package.json ./apps/desktop/package.json
COPY apps/extension/package.json ./apps/extension/package.json
COPY apps/flash/package.json ./apps/flash/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/calendar/package.json ./packages/calendar/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/focus/package.json ./packages/focus/package.json
COPY packages/pepper/package.json ./packages/pepper/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/sushi/package.json ./packages/sushi/package.json
COPY packages/sushi/cli/package.json ./packages/sushi/cli/package.json
COPY packages/sushi/packages/bam/package.json ./packages/sushi/packages/bam/package.json
COPY packages/sushi/packages/spatial-agents/package.json ./packages/sushi/packages/spatial-agents/package.json
COPY packages/sushi/packages/strike/package.json ./packages/sushi/packages/strike/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/waffles/package.json ./packages/waffles/package.json

# Install all dependencies (hono is needed at runtime)
RUN pnpm install --frozen-lockfile

# Build only the DB package (UI package doesn't need building for API)
RUN cd packages/db && pnpm run build || true

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install FFmpeg for video processing
RUN apk add --no-cache ffmpeg

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 hono

# Copy tsconfig.json FIRST for Bun path mappings
COPY --chown=hono:nodejs tsconfig.json ./tsconfig.json

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
RUN npm install -g bun@1.0.29

# Switch to non-root user
USER hono

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Run with Bun for better performance
CMD ["bun", "run", "apps/api/server.ts"]

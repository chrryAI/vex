FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm typescript

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ws/package*.json apps/ws/

# Install dependencies for the workspace and ws package
RUN pnpm install --frozen-lockfile --filter wsserver...

# Copy the rest of the code
COPY apps/ws ./apps/ws

# Build TypeScript
RUN pnpm --filter wsserver run build

# Remove devDependencies for a smaller final image
RUN pnpm prune --prod --workspace-root

# Create non-root user
RUN addgroup --system --gid 1001 wsgroup && \
    adduser --system --uid 1001 wsuser

# Set proper ownership
RUN chown -R wsuser:wsgroup /app

# Switch to the service directory for runtime
WORKDIR /app/apps/ws

# Switch to non-root user
USER wsuser

EXPOSE 3001

CMD ["node", "dist/index.js"]
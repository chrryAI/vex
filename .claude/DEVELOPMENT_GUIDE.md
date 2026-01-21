# Development Guide

## Prerequisites

- **Node.js**: 18+
- **pnpm**: 9.15.0+
- **PostgreSQL**: 14+
- **Redis**: Optional (Upstash for production)
- **Git**: For version control

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/chrryai/vex.git
cd vex
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Setup

Create `.env` files in the root and necessary app directories.

**Root `.env`:**

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/vex
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

**apps/flash/.env:**

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

**apps/api/.env:**

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/vex
JWT_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_test_...
```

### 4. Database Setup

```bash
# Generate Drizzle artifacts
pnpm generate

# Run migrations
pnpm migrate

# Seed database with default apps
pnpm seed
```

### 5. Start Development

```bash
# Start API + Flash apps
pnpm dev

# Or start all apps
pnpm dev:all
```

**Access:**

- Flash (PWA): http://localhost:3000
- API: http://localhost:3001

## Common Development Tasks

### Database Operations

**Generate Types:**

```bash
pnpm generate
```

**Create Migration:**

```bash
cd packages/db
pnpm drizzle-kit generate:pg
```

**Run Migrations:**

```bash
pnpm migrate
```

**Seed Database:**

```bash
pnpm seed
```

### SCSS to Universal Styles

**Convert All SCSS:**

```bash
pnpm s:all
```

**Convert Single File:**

```bash
pnpm s packages/ui/components/Button.scss
```

**Watch Mode:**

```bash
pnpm watch:scss
```

### Building

**Build All Apps:**

```bash
pnpm build
```

**Build Specific App:**

```bash
turbo build --filter=flash
turbo build --filter=api
```

### Testing

**Run E2E Tests:**

```bash
pnpm e2e
```

**Type Checking:**

```bash
pnpm check-types
```

**Linting:**

```bash
pnpm lint
```

**Format Code:**

```bash
pnpm format
```

### Translation

**Translate Files:**

```bash
pnpm translate
```

**Short Alias:**

```bash
pnpm t
```

### Publishing Packages

**Publish @chrryai/chrry:**

```bash
pnpm publish
```

## Project Structure

### Adding a New App

1. Create directory: `apps/your-app/`
2. Add `package.json` with workspace dependencies
3. Update root `package.json` workspaces
4. Add turbo tasks in `turbo.json`
5. Create app-specific code

### Adding a New Package

1. Create directory: `packages/your-package/`
2. Add `package.json` with proper name (`@repo/your-package`)
3. Export types and functions
4. Reference in apps via workspace protocol

### Adding a New Component

1. Navigate to `packages/ui/components/`
2. Create component file: `YourComponent.tsx`
3. Create styles: `YourComponent.scss`
4. Convert styles: `pnpm s packages/ui/components/YourComponent.scss`
5. Export from `packages/ui/index.ts`

## Code Style

### TypeScript

- Use strict mode
- Define proper types (avoid `any`)
- Use interface for object shapes
- Use type for unions/intersections

### React

- Functional components only
- Use hooks (useState, useEffect, etc.)
- Keep components small and focused
- Extract logic into custom hooks

### File Naming

- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Styles: `PascalCase.scss`
- Types: `types.ts` or inline

### Import Order

1. React and third-party
2. Internal packages (@chrryai/_, @repo/_)
3. Relative imports
4. Styles

## Debugging

### Enable Debug Logging

**Server:**

```bash
DEBUG=* pnpm dev
```

**Client (Browser Console):**

```javascript
localStorage.setItem("debug", "vex:*")
```

### Inspect Database

```bash
cd packages/db
pnpm drizzle-kit studio
```

Opens Drizzle Studio at http://localhost:4983

### WebSocket Debugging

Use browser DevTools → Network → WS to inspect WebSocket messages.

## Deployment

### Production Build

```bash
pnpm build
```

### Start Production

```bash
pnpm start:all
```

### Docker Build

```bash
docker build -t vex .
docker run -p 3000:3000 -p 3001:3001 vex
```

### Environment Variables

Ensure all production environment variables are set:

- Database URL (Neon)
- Redis URL (Upstash)
- API keys (OpenAI, Anthropic, etc.)
- Stripe keys
- JWT secret

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill

# Kill process on port 3001
lsof -ti:3001 | xargs kill
```

### Database Connection Issues

- Verify DATABASE_URL is correct
- Check PostgreSQL is running
- Ensure database exists

### Build Errors

```bash
# Clean node_modules
rm -rf node_modules
pnpm install

# Clean turbo cache
rm -rf .turbo

# Rebuild
pnpm build
```

### Type Errors

```bash
# Regenerate Drizzle types
pnpm generate

# Check types
pnpm check-types
```

## Best Practices

1. **Always run type checking** before committing
2. **Test locally** before pushing
3. **Write meaningful commit messages**
4. **Keep components platform-agnostic**
5. **Use universal styles** for cross-platform compatibility
6. **Document complex logic**
7. **Handle errors gracefully**
8. **Optimize database queries**
9. **Use React.memo** for expensive components
10. **Lazy load** routes and heavy components

## Resources

- [Turbo Documentation](https://turbo.build/repo/docs)
- [Drizzle ORM](https://orm.drizzle.team)
- [Vite](https://vitejs.dev)
- [React 19](https://react.dev)
- [Hono](https://hono.dev)

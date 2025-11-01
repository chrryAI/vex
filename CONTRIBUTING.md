# Contributing to Vex

Thank you for considering contributing to Vex! 🎉

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL 14+

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/chrryai/vex.git
   cd vex
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   # Copy example files
   cp apps/chrry-dot-dev/.env.example apps/chrry-dot-dev/.env
   cp packages/db/.env.example packages/db/.env

   # Edit .env files with your credentials
   ```

4. **Set up database**

   ```bash
   # Run migrations
   pnpm run migrate

   # Optional: seed with example data
   pnpm run seed
   ```

5. **Start development**

   ```bash
   # Start all services
   pnpm run dev

   # Or start specific apps
   pnpm run dev --filter=chrry-dot-dev
   ```

## Project Structure

```
vex/
├── apps/
│   ├── chrry-dot-dev/    # Main web application
│   ├── web/              # Alternative frontend
│   ├── ws/               # WebSocket server
│   ├── extension/        # Browser extension
│   └── native/           # React Native app
├── packages/
│   ├── ui/               # Shared UI components (@chrryai/chrry)
│   ├── pepper/           # Universal router (@chrryai/pepper)
│   ├── waffles/          # Testing utilities (@chrryai/waffles)
│   └── db/               # Database layer (@repo/db)
└── scripts/              # Build and utility scripts
```

## Development Workflow

### Making Changes

1. **Create a branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code style
   - Add tests for new features
   - Update documentation

3. **Test your changes**

   ```bash
   # Run linters
   pnpm run lint

   # Run type checks
   pnpm run check-types

   # Run tests
   pnpm run test
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

## Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (run `pnpm format`)
- **Linting**: ESLint (run `pnpm lint`)
- **Components**: Functional components with hooks

## Testing

- **Unit tests**: Write tests for utilities and functions
- **Integration tests**: Test API endpoints
- **E2E tests**: Use Playwright for critical flows

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update CHANGELOG.md
5. Request review from maintainers

## Adding New AI Providers

To add support for a new AI provider:

1. Update `lib/getModelProvider.ts` with new provider
2. Add provider configuration to agent schema
3. Update UI to support new provider
4. Add example .env variables
5. Update documentation

## Security

- Never commit sensitive data
- Use environment variables for secrets
- Follow security best practices (see SECURITY.md)
- Report vulnerabilities responsibly

## Questions?

- **Discord**: [Join our community](https://discord.gg/chrry)
- **Email**: dev@chrry.ai
- **Issues**: [GitHub Issues](https://github.com/chrryai/vex/issues)

Thank you for contributing! 🚀

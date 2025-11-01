# Vex

> A self-sustaining AI platform powered by user-provided models

## Features

- 🤖 Multi-model AI support (ChatGPT, Claude, DeepSeek, Gemini, and custom models)
- 🔌 OpenAI-compatible custom model integration
- 💾 Smart memory and context management
- 🎨 Cross-platform UI (Web, Extension, Native)
- 🔒 User-controlled API keys and data
- 📱 Real-time collaboration
- 🌍 Multi-language support

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL 14+

### Setup Instructions

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

   Copy the example files and add your own values:

   ```bash
   # Database configuration
   cp packages/db/.env.example packages/db/.env

   # Main app configuration
   cp apps/chrry-dot-dev/.env.example apps/chrry-dot-dev/.env

   # WebSocket server
   cp apps/ws/.env.example apps/ws/.env
   ```

   Edit the `.env` files and add:
   - Your PostgreSQL database URL
   - Your AI provider API keys (ChatGPT, Claude, DeepSeek, etc.)
   - Other required credentials (see `.env.example` files)

4. **Set up the database**

   ```bash
   # Navigate to the database package
   cd packages/db

   # Generate Drizzle schema
   pnpm run generate

   # Run migrations
   pnpm run migrate

   # Seed with example data
   pnpm run seed

   # Go back to root
   cd ../..
   ```

### Start All Services

```bash
# From root directory, start all services at once
pnpm run dev:all
```

This will start:

- Web app (localhost:3000)
- Chrry.dev (localhost:3001)
- WebSocket server (localhost:5001)

See [CONTRIBUTING.md](CONTRIBUTING.md) for more detailed setup instructions.

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `psql -h localhost -U postgres`
- Check your `DATABASE_URL` format: `postgresql://user:password@localhost:5432/dbname`
- Ensure the database exists: `createdb your_db_name`

### Build Errors

- Clear cache: `rm -rf .next node_modules && pnpm install`
- Rebuild packages: `pnpm run build`

### Missing Dependencies

- Install pnpm globally: `npm install -g pnpm@9.1.2`
- Check Node version: `node -v` (should be 18+)

## Architecture

Vex is a monorepo built with:

- **Frontend**: Next.js, React 19
- **Backend**: Next.js API routes, WebSocket server
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Multi-provider support with custom model integration
- **Packages**: Shared UI, routing, and testing utilities

### Project Structure

```
vex/
├── apps/
│   ├── chrry-dot-dev/    # Main Next.js app (localhost:3001)
│   ├── web/              # Alternative frontend (localhost:3000)
│   ├── ws/               # WebSocket server (localhost:5001)
│   ├── extension/        # Browser extension
│   └── native/           # React Native mobile app
├── packages/
│   ├── ui/               # Shared UI components (@chrryai/chrry)
│   ├── pepper/           # Universal router (@chrryai/pepper)
│   ├── waffles/          # Testing utilities (@chrryai/waffles)
│   └── db/               # Database layer with Drizzle ORM
└── scripts/              # Build and utility scripts
```

## Documentation

- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [API Documentation](docs/API.md)

## License

AGPL-3.0 - See [LICENSE](LICENSE)

**Note on Icons**: The icons used in this project are from [Wannathis](https://wannathis.one/) under a commercial license. If you fork this project, you'll need to replace the icons with your own or purchase a license. See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for details.

## Support

- Email: ilian@chrry.ai
- Issues: https://github.com/chrryai/vex/issues

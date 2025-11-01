# Chrry API

Next.js API application for the Chrry marketplace.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

3. Run the development server:

```bash
npm run dev
```

API will be available at [http://localhost:3001](http://localhost:3001)

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/apps` - Get all apps
- `POST /api/apps` - Create a new app
- `GET /api/stores` - Get all stores
- `POST /api/stores` - Create a new store

## Deployment

Deploy to Vercel:

```bash
vercel --prod
```

Set custom domain: `api.chrry.dev`

## Architecture

```
apps/api/
├── app/
│   ├── api/          # API routes
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page
├── middleware.ts     # CORS & auth
└── package.json
```

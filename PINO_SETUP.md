# Pino Logging with Axiom Setup

## ✅ Installed Packages

- `pino` - Fast JSON logger
- `pino-pretty` - Pretty print for development
- `@axiomhq/pino` - Axiom transport for Pino

## 📁 Files Created

### API Logger

`apps/api/lib/logger.ts`

- Dataset: `chrry-api`
- Console polyfill included
- Auto-sends logs to Axiom

### Flash Logger

`apps/flash/lib/logger.ts`

- Dataset: `chrry-flash`
- Console polyfill included
- Auto-sends logs to Axiom

## 🔧 Environment Variables

Add to your `.env`:

```bash
AXIOM_TOKEN=your-axiom-token-here
AXIOM_DATASET=chrry-api  # or chrry-flash for Flash
```

## 📖 Usage

### Option 1: Direct Logger

```typescript
import logger from "./lib/logger"

logger.info("User signed in", { userId: "123" })
logger.error("API error", { error: err.message })
logger.debug("Debug info", { data })
```

### Option 2: Console Polyfill (Easy Migration!)

```typescript
import { console } from "./lib/logger"

console.log("This goes to Axiom!")
console.error("Errors too!")
console.warn("Warnings!")
```

### Option 3: Global Polyfill

In your entry file (e.g., `apps/api/hono/index.ts`):

```typescript
import { console as pinoConsole } from "./lib/logger"
globalThis.console = pinoConsole as any

// Now all console.log() calls go to Axiom!
console.log("Automatic logging!")
```

## 🎯 Benefits

✅ **Structured Logging** - JSON format, easy to query
✅ **Fast** - Minimal performance impact
✅ **Bun Compatible** - Works perfectly with Bun
✅ **Console Polyfill** - Easy migration from console.log
✅ **Axiom Integration** - Automatic log shipping
✅ **Separate Datasets** - API and Flash logs separated

## 🚀 Next Steps

1. Get your Axiom token from https://axiom.co
2. Add `AXIOM_TOKEN` to `.env`
3. Import logger in your code
4. Start logging!

## 📊 Axiom Datasets

- `chrry-api` - All API logs (Hono)
- `chrry-flash` - All Flash SSR logs

You can query them separately in Axiom dashboard!

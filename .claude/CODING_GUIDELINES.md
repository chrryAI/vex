# Coding Guidelines

## General Principles

### 1. Platform Agnostic Code

Write code that works across web, mobile, and desktop.

**DO:**

```typescript
import { Platform } from '@chrryai/chrry';

const Component = () => {
  return Platform.select({
    web: <div>Web Content</div>,
    native: <View>Native Content</View>,
  });
};
```

**DON'T:**

```typescript
// Platform-specific imports without fallback
import { SomeWebOnlyAPI } from "web-only-package"
```

### 2. Type Safety

Always use TypeScript with strict mode enabled.

**DO:**

```typescript
interface User {
  id: string
  email: string
  name: string | null
}

function getUser(id: string): Promise<User> {
  return db.users.findFirst({ where: { id } })
}
```

**DON'T:**

```typescript
function getUser(id: any): any {
  return db.users.findFirst({ where: { id } })
}
```

### 3. Error Handling

Handle errors gracefully and provide meaningful messages.

**DO:**

```typescript
try {
  const result = await aiAgent.chat(message)
  return result
} catch (error) {
  if (error instanceof APIError) {
    toast.error(`AI Error: ${error.message}`)
  } else {
    logger.error("Unexpected error:", error)
    toast.error("Something went wrong. Please try again.")
  }
  throw error
}
```

**DON'T:**

```typescript
const result = await aiAgent.chat(message) // No error handling
```

## React Guidelines

### Component Structure

**Functional Components:**

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  disabled = false
}) => {
  return (
    <button type="button"  onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};
```

### Hooks Best Practices

**Custom Hooks:**

```typescript
function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchUser() {
      try {
        setLoading(true)
        const data = await api.getUser(userId)
        if (!cancelled) {
          setUser(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchUser()

    return () => {
      cancelled = true
    }
  }, [userId])

  return { user, loading, error }
}
```

### Performance Optimization

**Use React.memo:**

```typescript
export const ExpensiveComponent = React.memo<Props>(({ data }) => {
  // Expensive rendering
  return <div>{/* ... */}</div>;
});
```

**Use useCallback:**

```typescript
const handleClick = useCallback(() => {
  console.log("Clicked")
}, []) // Empty deps if no dependencies
```

**Use useMemo:**

```typescript
const sortedItems = useMemo(() => {
  return items.sort((a, b) => a.name.localeCompare(b.name))
}, [items])
```

## Database Guidelines

### Drizzle ORM Patterns

**Queries:**

```typescript
// DO: Use type-safe queries
const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)

// DON'T: Use raw SQL unless necessary
const user = await db.execute(sql`SELECT * FROM users WHERE id = ${userId}`)
```

**Transactions:**

```typescript
await db.transaction(async (tx) => {
  const user = await tx.insert(users).values(userData).returning()
  await tx.insert(threads).values({ userId: user.id })
})
```

**Joins:**

```typescript
const threadsWithMessages = await db
  .select()
  .from(threads)
  .leftJoin(messages, eq(threads.id, messages.threadId))
  .where(eq(threads.userId, userId))
```

### Redis Caching

**Pattern:**

```typescript
async function getCachedUser(userId: string): Promise<User> {
  const cached = await redis.get(`user:${userId}`)
  if (cached) {
    return JSON.parse(cached)
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  await redis.set(`user:${userId}`, JSON.stringify(user), "EX", 3600)
  return user
}
```

## API Guidelines

### Hono Route Handlers

**Structure:**

```typescript
app.get("/api/users/:id", async (c) => {
  const userId = c.req.param("id")

  // Validate
  if (!userId) {
    return c.json({ error: "User ID required" }, 400)
  }

  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      return c.json({ error: "User not found" }, 404)
    }

    return c.json({ user })
  } catch (error) {
    logger.error("Error fetching user:", error)
    return c.json({ error: "Internal server error" }, 500)
  }
})
```

### WebSocket Patterns

**Connection Management:**

```typescript
wss.on("connection", (ws, req) => {
  const userId = extractUserIdFromRequest(req)

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString())
      await handleMessage(ws, userId, message)
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: "Invalid message format",
        }),
      )
    }
  })

  ws.on("close", () => {
    cleanupUserConnection(userId)
  })
})
```

## Styling Guidelines

### SCSS Best Practices

**Component Styles:**

```scss
// Button.scss
.button {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s;

  &--primary {
    background: var(--color-primary);
    color: white;
  }

  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(&--disabled) {
    transform: translateY(-2px);
  }
}
```

**Convert to Universal:**

```bash
pnpm s packages/ui/components/Button.scss
```

### CSS Variables

Use CSS variables for theming:

```scss
:root {
  --color-primary: #6366f1;
  --color-secondary: #ec4899;
  --color-background: #ffffff;
  --color-text: #1f2937;
  --spacing-unit: 8px;
}
```

## Testing Guidelines

### E2E Tests with Playwright

**Test Structure:**

```typescript
import { test, expect } from "@playwright/test"

test.describe("Authentication", () => {
  test("should login successfully", async ({ page }) => {
    await page.goto("http://localhost:3000")

    await page.fill('[name="email"]', "test@example.com")
    await page.fill('[name="password"]', "password123")
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.locator(".user-menu")).toBeVisible()
  })
})
```

## Security Guidelines

### Input Validation

**Always validate user input:**

```typescript
import { z } from "zod"

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().min(0).max(120),
})

app.post("/api/users", async (c) => {
  const body = await c.req.json()

  try {
    const validatedData = userSchema.parse(body)
    // Proceed with validated data
  } catch (error) {
    return c.json({ error: "Invalid input" }, 400)
  }
})
```

### Sanitize HTML

**Use sanitize-html:**

```typescript
import sanitizeHtml from "sanitize-html"

const cleanHtml = sanitizeHtml(userInput, {
  allowedTags: ["b", "i", "em", "strong", "a"],
  allowedAttributes: {
    a: ["href"],
  },
})
```

### Rate Limiting

**Use Arcjet or Upstash:**

```typescript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
})

app.post("/api/chat", async (c) => {
  const identifier = c.req.header("x-user-id") || "anonymous"
  const { success } = await ratelimit.limit(identifier)

  if (!success) {
    return c.json({ error: "Rate limit exceeded" }, 429)
  }

  // Proceed with request
})
```

## Performance Guidelines

### Database Optimization

**Use indexes:**

```typescript
// In schema
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    createdAtIdx: index("users_created_at_idx").on(table.createdAt),
  }),
)
```

**Batch operations:**

```typescript
// DO: Batch insert
await db
  .insert(messages)
  .values([
    { content: "Message 1" },
    { content: "Message 2" },
    { content: "Message 3" },
  ])

// DON'T: Multiple individual inserts
for (const message of messages) {
  await db.insert(messages).values(message)
}
```

### Bundle Optimization

**Lazy load routes:**

```typescript
import { lazy } from "react"

const Dashboard = lazy(() => import("./pages/Dashboard"))
const Settings = lazy(() => import("./pages/Settings"))
```

**Code splitting:**

```typescript
// Dynamic imports for heavy libraries
const loadMarkdown = async () => {
  const { marked } = await import("marked")
  return marked
}
```

## Documentation Guidelines

### JSDoc Comments

**Functions:**

```typescript
/**
 * Fetches user data from the database
 * @param userId - The unique identifier of the user
 * @returns User object or null if not found
 * @throws {DatabaseError} If database connection fails
 */
async function getUser(userId: string): Promise<User | null> {
  // Implementation
}
```

**Components:**

```typescript
/**
 * Button component with multiple variants
 *
 * @example
 * <Button variant="primary" onClick={handleClick}>
 *   Click Me
 * </Button>
 */
export const Button: React.FC<ButtonProps> = (props) => {
  // Implementation
}
```

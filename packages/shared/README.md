# @repo/shared

Shared contexts, types, and platform adapters for Vex across web, mobile, and extension.

## Structure

```
src/
├── contexts/          # React contexts (empty implementations)
│   ├── PlatformContext.tsx
│   ├── AuthContext.tsx
│   ├── ChatContext.tsx
│   ├── AgentContext.tsx
│   ├── MemoryContext.tsx
│   ├── CollaborationContext.tsx
│   └── SubscriptionContext.tsx
├── platform/          # Platform adapter types
│   └── types.ts
└── types/             # Shared TypeScript types
    └── index.ts
```

## Usage

### 1. Create Platform Adapter

```typescript
// apps/two/platform/adapter.ts (Mobile with MMKV)
import { MMKV } from "react-native-mmkv"
import type { PlatformAdapter } from "@repo/shared/platform/types"

const storage = new MMKV()

export const mobilePlatform: PlatformAdapter = {
  storage: {
    getString: (key) => storage.getString(key),
    setString: (key, value) => storage.set(key, value),
    // ... etc
  },
  // ... rest of adapter
}
```

### 2. Implement Context Providers

```typescript
// apps/two/providers/AuthProvider.tsx
import { AuthProvider, type AuthContextType } from '@repo/shared'

export function MobileAuthProvider({ children }) {
  const value: AuthContextType = {
    // Your implementation here
  }

  return <AuthProvider value={value}>{children}</AuthProvider>
}
```

### 3. Use in App

```typescript
import { PlatformProvider, useAuth, useChat } from '@repo/shared'
import { mobilePlatform } from './platform/adapter'

function App() {
  return (
    <PlatformProvider adapter={mobilePlatform}>
      <MobileAuthProvider>
        <MobileChatProvider>
          <YourApp />
        </MobileChatProvider>
      </MobileAuthProvider>
    </PlatformProvider>
  )
}
```

## Contexts

- **PlatformContext**: Platform-specific APIs (storage, notifications, etc.)
- **AuthContext**: User authentication and session management
- **ChatContext**: Messaging and threads
- **AgentContext**: AI agents management
- **MemoryContext**: AI memory and context
- **CollaborationContext**: Real-time collaboration
- **SubscriptionContext**: Subscription and credits management

## Next Steps

1. Implement platform adapters for each platform (web, mobile, extension)
2. Implement context providers for each platform
3. Share business logic across all platforms!

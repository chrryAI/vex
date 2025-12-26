---
description: Unified testing framework for web, extension, and Tauri desktop
---

# Unified Testing Strategy

**Goal:** One test suite that runs across all platforms (web, extension, Tauri)

## Current State (v1.8.36)

### ✅ What Works Now

- **Playwright tests** for web (`packages/waffles`)
- Tests run on `chromium` project
- E2E tests for guest/member flows
- Video recordings of test runs

### ❌ What's Missing

- Extension-specific tests
- Tauri desktop tests
- Cross-platform test runner

## Future Unified Framework

### Architecture

```
packages/waffles/
├── src/
│   ├── shared/           # Shared test utilities
│   ├── web.spec.ts       # Web-specific tests
│   ├── extension.spec.ts # Extension-specific tests
│   └── tauri.spec.ts     # Tauri-specific tests
└── playwright.config.ts  # Multi-project config
```

### Test Projects

**1. Web (Chromium) - CURRENT**

```typescript
{
  name: "web-chromium",
  use: { ...devices["Desktop Chrome"] },
  testMatch: /.*\.web\.spec\.ts/,
}
```

**2. Extension (Chrome/Firefox) - TODO**

```typescript
{
  name: "extension-chrome",
  use: {
    ...devices["Desktop Chrome"],
    // Load extension from dist/
    extensionPath: "./apps/extension/dist",
  },
  testMatch: /.*\.extension\.spec\.ts/,
}
```

**3. Tauri Desktop (macOS/Windows/Linux) - TODO**

```typescript
{
  name: "tauri-macos",
  use: {
    // Connect to tauri-driver
    webDriver: "http://localhost:4444",
  },
  testMatch: /.*\.tauri\.spec\.ts/,
}
```

## Implementation Plan

### Phase 1: Web Testing (DONE ✅)

- Playwright setup
- Guest/member flows
- Video recordings

### Phase 2: Extension Testing (LATER)

1. Install `@playwright/test` extension support
2. Build extension before tests
3. Load extension in Chromium/Firefox
4. Test sidebar, context menus, OAuth

### Phase 3: Tauri Testing (LATER)

1. Install `tauri-driver`
2. Build Tauri app before tests
3. Use WebDriver protocol
4. Test native features (window controls, tray, etc.)

### Phase 4: Unified Runner (LATER)

```bash
# Run all tests
pnpm test:all

# Run specific platform
pnpm test:web
pnpm test:extension
pnpm test:tauri

# Run in CI
pnpm test:ci
```

## Test Coverage Strategy

### Shared Tests (90% of functionality)

- Authentication (OAuth, credentials)
- Chat flows
- Agent creation
- Subscriptions
- Multi-language

**Run on:** Web, Extension, Tauri

### Platform-Specific Tests (10%)

**Extension only:**

- Sidebar opens correctly
- Context menu items work
- Browser action triggers

**Tauri only:**

- Window controls (drag, maximize)
- System tray icon
- Native notifications
- Auto-updates

## Tools & Dependencies

### Current

- `@playwright/test` - E2E testing
- `@chrryai/waffles` - Test utilities

### Future

- `tauri-driver` - Tauri WebDriver
- `thirtyfour` - Rust WebDriver client (optional)
- `@playwright/test` extension support

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm test:web

  test-extension:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm build:extension
      - run: pnpm test:extension

  test-tauri:
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm tauri build
      - run: pnpm test:tauri
```

## Priority

**NOW (v1.8.36):**

- ✅ Ship desktop app
- ✅ Manual testing
- ✅ Web Playwright tests

**LATER (v2.0):**

- Extension tests
- Tauri tests
- Unified runner
- CI/CD integration

## Notes

- Extension = Marketing funnel (reach)
- Desktop = Real product (99% usage)
- Web = Fallback (compatibility)

**Focus on shipping, not testing infrastructure.**

Test later when you have users and revenue.

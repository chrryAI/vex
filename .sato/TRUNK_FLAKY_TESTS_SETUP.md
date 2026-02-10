# Trunk Flaky Tests Setup - Complete ✅

## 🎯 What We Did

Configured Trunk Flaky Tests for automatic detection and quarantining of flaky tests in CI/CD.

## ✅ Configuration Complete

### 1. Playwright Config (`packages/waffles/playwright.config.ts`)

- ✅ Added JUnit XML reporter: `["junit", { outputFile: "junit.xml" }]`
- ✅ Disabled retries: `retries: 0` (required for accurate flaky test detection)

### 2. Git Ignore (`.gitignore`)

- ✅ Added `junit.xml` to ignore test report artifacts

### 3. Trunk Configuration (`.trunk/`)

- ✅ Trunk automatically manages its own `.gitignore`
- ✅ Config files in `.trunk/configs/` are team-shared
- ✅ Runtime artifacts (logs, tools, plugins) are auto-ignored

### 4. GitHub Actions CI (`.github/workflows/ci.yml`)

- ✅ Added Trunk upload step to `e2e-guest-live` job
- ✅ Added Trunk upload step to `e2e-member-live` job
- ✅ Configured with `if: ${{ !cancelled() }}` to upload even on test failures
- ✅ Configured with `continue-on-error: true` to not fail CI on upload issues

## 🔐 Required: Add GitHub Secret

**CRITICAL:** You must add the Trunk API token as a GitHub secret:

1. Get your Trunk API token from: https://app.trunk.io/chrry/settings/api-tokens
2. Go to: https://github.com/chrryAI/vex/settings/secrets/actions
3. Click "New repository secret"
4. Name: `TRUNK_API_TOKEN`
5. Value: `<your-trunk-api-token-from-step-1>`
6. Click "Add secret"

## 🧪 Test Locally (Optional)

Before the next CI run, you can validate locally:

```bash
# Install Trunk CLI
curl -fsSLO --retry 3 https://trunk.io/releases/trunk && chmod +x trunk

# Run tests to generate junit.xml
cd packages/waffles
pnpm test:e2e

# Validate the report
../../trunk flakytests validate --junit-paths "./junit.xml"

# Test upload (optional - requires token from Trunk dashboard)
../../trunk flakytests upload \
  --junit-paths "./junit.xml" \
  --org-url-slug chrry \
  --token <your-trunk-api-token>
```

## 📊 What Happens Next

Once the GitHub secret is added and CI runs:

1. **Tests run** - Playwright generates `junit.xml`
2. **Upload to Trunk** - Results are uploaded even if tests fail
3. **Flaky Detection** - Trunk analyzes test patterns across runs
4. **Quarantining** - Flaky tests are automatically quarantined
5. **Dashboard** - View analytics at https://app.trunk.io

## 🎯 Benefits

- ✅ **Automatic Flaky Test Detection** - No manual tracking needed
- ✅ **Quarantining** - Flaky tests don't block CI
- ✅ **Analytics** - Track test performance and reliability over time
- ✅ **No More Retries** - Retries hide flakiness; Trunk handles it properly
- ✅ **Team Visibility** - Everyone sees which tests are flaky

## 📝 Important Notes

- **Retries are disabled** - This is intentional and required for Trunk
- **JUnit output** - Generated at `packages/waffles/junit.xml` after each test run
- **Team config** - `.trunk/` folder should be committed to git
- **Runtime artifacts** - Auto-ignored via `.trunk/.gitignore`
- **Upload on failure** - Tests upload even when they fail (by design)

## 🔍 Monitoring

After CI runs with the secret configured:

1. Check the "Upload Test Results to Trunk" step in GitHub Actions
2. Visit https://app.trunk.io/chrry to see your test analytics
3. Look for flaky tests in the "Tests" tab
4. Quarantined tests will be marked and won't fail CI

## 📚 Documentation

- [Trunk Flaky Tests Docs](https://docs.trunk.io/flaky-tests)
- [Playwright JUnit Reporter](https://playwright.dev/docs/test-reporters#junit-reporter)
- [Trunk Analytics Uploader](https://github.com/trunk-io/analytics-uploader)

## ⚠️ Next Action Required

**Add the GitHub secret `TRUNK_API_TOKEN` before the next CI run!**

Without the secret, the upload step will fail (but won't block CI due to `continue-on-error: true`).

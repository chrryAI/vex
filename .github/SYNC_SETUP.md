# Setting Up Vex Sync to Public Repo

This document explains how to set up the automated sync from your private Vex repo to the public `chrryai/vex` repository.

## How It Works

The sync workflow (`sync-vex.yml`) automatically pushes commits from your current branch (e.g., `chrry`) to the public `chrryai/vex` repo's `main` branch. Similar to the Chrry workflow, this **force pushes fresh commits** without including old history.

## Setup Steps

### 1. Create Personal Access Token (PAT)

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Configure the token:
   - **Name**: `CHRRY_SYNC_TOKEN` (using same token as Chrry sync)
   - **Expiration**: No expiration (or set long expiration)
   - **Scopes**:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)

4. Click "Generate token"
5. **Copy the token immediately** (you won't see it again!)

### 2. Add Token to Private Repo Secrets

1. Go to your **private Vex repo** settings
2. Navigate to: Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Configure:
   - **Name**: `CHRRY_SYNC_TOKEN`
   - **Secret**: Paste the token you generated
5. Click "Add secret"

> **Note**: If you already have `CHRRY_SYNC_TOKEN` from the Chrry sync workflow, you can reuse it!

### 3. Create Public Repository

If you haven't already:

1. Go to https://github.com/chrryai
2. Click "New repository"
3. Configure:
   - **Name**: `vex`
   - **Description**: "A self-sustaining AI platform powered by user-provided models"
   - **Visibility**: ✅ Public
   - **Initialize**: ❌ Do NOT initialize with README (workflow will push existing code)
4. Click "Create repository"

### 4. Initial Sync (Manual)

Run the first sync manually to push all commits:

1. Go to your private repo → Actions tab
2. Click "Sync Vex to Public Repo" workflow
3. Click "Run workflow" → Select `main` branch
4. Click "Run workflow" button

The workflow will:

- ✅ Check for sensitive data (will fail if found)
- ✅ Push all commits from main branch
- ✅ Push tags
- ✅ Verify sync completed

### 5. Verify Sync

Check the public repo: https://github.com/chrryai/vex

You should see:

- All your commits
- All files except .env and other gitignored items
- README with setup instructions

## Usage

### Automatic Sync

After initial setup, the workflow runs automatically:

- ✅ Every time you push to `main` branch in private repo
- ✅ New commits are automatically synced to public repo
- ✅ Preserves full git history

### Manual Sync

You can also trigger manually:

1. Go to Actions tab in private repo
2. Click "Sync Vex to Public Repo"
3. Click "Run workflow"

## Security Features

The workflow includes security checks that will **fail the sync** if:

- ❌ `.env` files are in git
- ❌ API keys are detected in code
- ❌ Other sensitive patterns found

If sync fails due to security issues:

1. Review the workflow logs
2. Fix the security issue (remove sensitive data)
3. Commit the fix
4. Workflow will auto-retry on next push

## Workflow File

The workflow is defined in: `.github/workflows/sync-vex.yml`

Key differences from Chrry sync:

- **Vex**: Pushes new commits, preserves history (`git push`)
- **Chrry**: Creates fresh commits, rewrites history (`git push -f`)

## Troubleshooting

### Sync Fails: "Authentication failed"

- Verify `VEX_SYNC_TOKEN` secret exists in private repo
- Check token has correct scopes (`repo`, `workflow`)
- Token might be expired, generate a new one

### Sync Fails: "Security checks failed"

- Review the workflow logs to see what was detected
- Use the security check script: `./scripts/check-sensitive-data.sh`
- Remove sensitive data and push again

### Commits Not Syncing

- Verify workflow is enabled (Actions tab)
- Check workflow ran successfully (Actions → Sync Vex)
- Ensure you're pushing to `main` branch

### Need to Re-sync Everything

If you need to force-push (careful!):

```bash
# In your private repo
git push public main --force

# Or update workflow to add -f flag temporarily
```

## Maintenance

### Token Expiration

If you set an expiration date:

1. Generate a new token before expiration
2. Update the `VEX_SYNC_TOKEN` secret in private repo
3. Sync will continue working automatically

### Workflow Updates

If you modify `.github/workflows/sync-vex.yml`:

- Changes will be synced to public repo
- Public repo will use the updated workflow for future syncs

## Best Practices

1. **Always review commits** before pushing to main
2. **Never commit .env files** - they're gitignored
3. **Use the security check script** before pushing: `./scripts/check-sensitive-data.sh`
4. **Keep token secure** - never share or commit it
5. **Monitor workflow runs** - check Actions tab regularly

## Support

If you encounter issues:

- Check workflow logs: Private repo → Actions → Sync Vex workflow
- Review security checklist: `OPEN_SOURCE_CHECKLIST.md`
- Run security checks: `./scripts/check-sensitive-data.sh`

---

Happy syncing! 🚀 Long live Chrry! 👑

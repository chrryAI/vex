# Tauri Auto-Update Setup Guide

## Overview

Tauri's auto-update system allows apps to automatically check for and install updates. This is crucial for:

- 🔒 Security patches
- 🐛 Bug fixes
- ✨ New features
- 📱 Better user experience

## How It Works

1. **App checks for updates** on startup (or manually triggered)
2. **Downloads new version** in background
3. **Verifies signature** to ensure authenticity
4. **Prompts user** to install update
5. **Installs and restarts** with new version

---

## Setup Steps

### 1. Generate Update Signing Keys

First, generate a keypair for signing updates:

```bash
cd apps/browser/src-tauri
cargo install tauri-cli
cargo tauri signer generate -w ~/.tauri/vex.key
```

This creates:

- **Private key**: `~/.tauri/vex.key` (keep secret!)
- **Public key**: Printed to console (add to config)

**⚠️ IMPORTANT:**

- Back up the private key securely
- Never commit it to git
- You'll need it to sign every update

---

### 2. Update Tauri Configuration

Add the updater config to `tauri.conf.template.json`:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://vex.chrry.ai/api/updates/{{target}}/{{current_version}}"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    },
    "deep-link": {
      "schemes": ["vex"],
      "mobile": []
    }
  }
}
```

**Replace `YOUR_PUBLIC_KEY_HERE`** with the public key from step 1.

**Endpoint variables:**

- `{{target}}`: Platform (e.g., `darwin-aarch64`, `darwin-x86_64`)
- `{{current_version}}`: Current app version (e.g., `0.1.0`)

---

### 3. Create Update Server Endpoint

Your server needs to return JSON with update info:

**Example: `https://vex.chrry.ai/api/updates/darwin-aarch64/0.1.0`**

```json
{
  "version": "0.2.0",
  "notes": "Bug fixes and new features",
  "pub_date": "2025-12-28T22:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVU...",
      "url": "https://vex.chrry.ai/installs/Vex_0.2.0_aarch64.dmg"
    },
    "darwin-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVU...",
      "url": "https://vex.chrry.ai/installs/Vex_0.2.0_x64.dmg"
    }
  }
}
```

**Response rules:**

- If `version` > `current_version`: Update available
- If `version` <= `current_version`: No update
- Return `204 No Content` if no update available

---

### 4. Sign Updates

After building a new version, sign the DMG:

```bash
# Sign the DMG with your private key
cargo tauri signer sign \
  "src-tauri/target/release/bundle/dmg/Vex_0.2.0_aarch64.dmg" \
  -k ~/.tauri/vex.key
```

This outputs the **signature** - add it to your update JSON.

---

### 5. Add Update Check to Your App

Create `apps/browser/src-tauri/src/updater.rs`:

```rust
use tauri::Emitter;
use tauri_plugin_updater::UpdaterExt;

pub async fn check_for_updates(app: tauri::AppHandle) {
    if let Some(updater) = app.updater() {
        match updater.check().await {
            Ok(Some(update)) => {
                println!("Update available: {}", update.version);

                // Show update dialog
                let _ = app.emit("update-available", update.version);

                // Download and install
                if let Err(e) = update.download_and_install().await {
                    eprintln!("Failed to install update: {}", e);
                }
            }
            Ok(None) => {
                println!("No updates available");
            }
            Err(e) => {
                eprintln!("Failed to check for updates: {}", e);
            }
        }
    }
}
```

Call it in `main.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();

            // Check for updates on startup
            tauri::async_runtime::spawn(async move {
                updater::check_for_updates(handle).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### 6. Frontend Integration (Optional)

Listen for update events in your React app:

```typescript
import { listen } from "@tauri-apps/api/event"
import { check } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"

// Check for updates manually
async function checkForUpdates() {
  const update = await check()

  if (update?.available) {
    console.log(`Update to ${update.version} available!`)
    console.log(`Release notes: ${update.body}`)

    // Download and install
    await update.downloadAndInstall()

    // Restart app
    await relaunch()
  }
}

// Listen for update events
listen("update-available", (event) => {
  console.log("Update available:", event.payload)
  // Show notification to user
})
```

---

## API Endpoint Implementation

### Option 1: Static JSON Files

Simple approach - host JSON files for each version:

```
https://vex.chrry.ai/updates/
  ├── darwin-aarch64/
  │   ├── 0.1.0.json
  │   ├── 0.2.0.json
  │   └── latest.json
  └── darwin-x86_64/
      ├── 0.1.0.json
      └── latest.json
```

### Option 2: Dynamic API (Recommended)

Create an API endpoint in your backend:

```typescript
// apps/api/hono/routes/updates.ts
import { Hono } from "hono"

const updates = new Hono()

updates.get("/:platform/:version", async (c) => {
  const { platform, version } = c.req.param()

  // Get latest version from database or config
  const latestVersion = "0.2.0"

  // Compare versions
  if (version >= latestVersion) {
    return c.body(null, 204) // No update
  }

  // Return update info
  return c.json({
    version: latestVersion,
    notes: "Bug fixes and improvements",
    pub_date: new Date().toISOString(),
    platforms: {
      [platform]: {
        signature: await getSignature(platform, latestVersion),
        url: `https://vex.chrry.ai/installs/Vex_${latestVersion}_${platform}.dmg`,
      },
    },
  })
})

export default updates
```

---

## Release Process

When releasing a new version:

1. **Update version** in `tauri.conf.template.json`:

   ```json
   {
     "version": "0.2.0"
   }
   ```

2. **Build all apps**:

   ```bash
   ./build-and-release.sh
   ```

3. **Sign each DMG**:

   ```bash
   for dmg in public/installs/*.dmg; do
     cargo tauri signer sign "$dmg" -k ~/.tauri/vex.key
   done
   ```

4. **Update your API** with new version and signatures

5. **Upload DMGs** to your server

6. **Test update** on an older version

---

## Testing

### Test Update Flow

1. Install version `0.1.0` on a test Mac
2. Update your API to return version `0.2.0`
3. Launch the app
4. Should see update prompt
5. Click "Update"
6. App downloads, installs, and restarts

### Manual Update Check

Add a menu item or button:

```typescript
import { check } from '@tauri-apps/plugin-updater'

<button onClick={checkForUpdates}>
  Check for Updates
</button>
```

---

## Security Best Practices

✅ **DO:**

- Keep private signing key secure (never commit)
- Use HTTPS for update endpoints
- Verify signatures on client
- Use semantic versioning
- Test updates thoroughly

❌ **DON'T:**

- Commit signing keys to git
- Use HTTP for updates
- Skip signature verification
- Force updates without user consent

---

## Troubleshooting

### Update Not Detected

- Check endpoint URL is correct
- Verify version comparison logic
- Check network requests in console
- Ensure signature is valid

### Signature Verification Failed

- Re-sign the DMG with correct key
- Verify public key in config matches private key
- Check signature format

### Update Download Fails

- Verify DMG URL is accessible
- Check file permissions
- Ensure DMG is properly signed and notarized

---

## Next Steps

1. ✅ Finish current build (get notarized apps)
2. ✅ Deploy DMGs to server
3. 🔄 Generate update signing keys
4. 🔄 Add updater config to Tauri
5. 🔄 Create update API endpoint
6. 🔄 Rebuild with updater enabled
7. 🔄 Test update flow

---

## Resources

- [Tauri Updater Plugin](https://v2.tauri.app/plugin/updater/)
- [Signing Updates](https://v2.tauri.app/plugin/updater/#signing-updates)
- [Update Server](https://v2.tauri.app/plugin/updater/#update-server)

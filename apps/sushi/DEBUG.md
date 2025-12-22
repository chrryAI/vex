# Debugging Sushi Extension - New Tab Not Working

## Issue

The extension loads in Chrome, but opening a new tab shows the regular Google home screen instead of Sushi.

## Root Cause

The `chrome_url_overrides.newtab` permission requires:

1. **Extension must be enabled** in chrome://extensions
2. **Chrome must be restarted** after installing the extension
3. **Only ONE extension** can override the new tab at a time

## Steps to Fix

### 1. Check if Extension is Loaded

1. Open Chrome (the one that just launched)
2. Go to `chrome://extensions`
3. Look for "Sushi 🍒" extension
4. **Make sure it's ENABLED** (toggle should be blue/on)

### 2. Verify New Tab Override

1. Still on `chrome://extensions`
2. Click "Details" on the Sushi extension
3. Scroll down to "Permissions"
4. You should see: "Override the new tab page"

### 3. Restart Chrome

**IMPORTANT**: The new tab override only activates after Chrome restarts!

1. Close ALL Chrome windows completely
2. Run the command again:
   ```bash
   cd /Users/ibrahimvelinov/Documents/vex/apps/sushi
   pnpm dev:browser
   ```
3. Open a new tab (Cmd+T)
4. You should now see Sushi instead of Google

### 4. Check for Conflicting Extensions

If it still doesn't work:

1. Go to `chrome://extensions`
2. Look for other extensions that might override the new tab
3. Disable any "New Tab" extensions temporarily
4. Restart Chrome

### 5. Manual Verification

If the above doesn't work, manually check the extension:

1. Go to `chrome://extensions`
2. Find "Sushi 🍒"
3. Click the extension icon in the toolbar (if visible)
4. Or right-click → "Inspect popup" to see if there are any errors

## Expected Behavior

When working correctly:

- **New Tab (Cmd+T)**: Shows Sushi IDE with black background
- **Extension Icon**: Shows "🍒" in the toolbar
- **No Google**: Google's home screen should never appear

## Troubleshooting

### Extension Not Showing in chrome://extensions

- The extension path might be wrong
- Check: `/Users/ibrahimvelinov/Documents/vex/apps/sushi/dist`
- Make sure `manifest.json` exists in that folder

### New Tab Still Shows Google

- Another extension is overriding it
- Chrome wasn't fully restarted
- Extension is disabled

### Black Screen on New Tab

- JavaScript error in the extension
- Check Console: Right-click on new tab → Inspect → Console tab

## Quick Test Command

To verify the manifest is correct:

```bash
cd /Users/ibrahimvelinov/Documents/vex/apps/sushi
cat dist/manifest.json | grep -A 3 "chrome_url_overrides"
```

Should output:

```json
"chrome_url_overrides": {
  "newtab": "index.html"
}
```

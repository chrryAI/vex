import { browserAPI } from "../browser-api"

/**
 * Update the extension icon dynamically based on app context
 * @param iconVariant - The icon variant to use (e.g., 'atlas', 'peach', 'vault', 'bloom', 'focus', etc.)
 */
export const updateExtensionIcon = async (iconVariant?: string) => {
  // Default to 'vex' if no variant provided
  const appSlug = iconVariant || "vex"

  try {
    // Chrome/Edge API
    if (browserAPI.action?.setIcon) {
      await browserAPI.action.setIcon({
        path: {
          16: `icons/${appSlug}-icon-16.png`,
          32: `icons/${appSlug}-icon-32.png`,
          48: `icons/${appSlug}-icon-48.png`,
          128: `icons/${appSlug}-icon-128.png`,
        },
      })
      console.log("🎨 Extension icon updated to:", appSlug)
    }
  } catch (error) {
    console.error("Failed to update extension icon:", error)
  }
}

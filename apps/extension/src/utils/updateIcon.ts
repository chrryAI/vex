import { browserAPI } from "../browser-api"

/**
 * Update the extension icon dynamically based on app context
 * @param iconVariant - The icon variant to use (e.g., 'atlas', 'peach', 'vault')
 */
export const updateExtensionIcon = async (iconVariant?: string) => {
  // Map app slugs to icon paths
  const iconMap: Record<string, string> = {
    atlas: "icons/icon-atlas-128.png",
    peach: "icons/icon-peach-128.png",
    bloom: "icons/icon-bloom-128.png",
    vault: "icons/icon-vault-128.png",
    vex: "icons/icon-vex-128.png",
    default: "icons/icon-128.png",
  }

  const iconPath =
    iconVariant && iconMap[iconVariant] ? iconMap[iconVariant] : iconMap.default

  try {
    // Chrome/Edge API
    if (browserAPI.action?.setIcon) {
      await browserAPI.action.setIcon({
        path: {
          16: iconPath.replace("128", "16"),
          32: iconPath.replace("128", "32"),
          48: iconPath.replace("128", "48"),
          128: iconPath,
        },
      })
      console.log("🎨 Extension icon updated to:", iconVariant || "default")
    }
  } catch (error) {
    console.error("Failed to update extension icon:", error)
  }
}

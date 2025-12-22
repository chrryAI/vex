/// <reference types="chrome" />

export const getEnv = () => {
  if (typeof import.meta !== "undefined") {
    return (import.meta as any).env || {}
  }

  if (typeof process === "undefined") return {}
  return process.env || {}
}

export const isCI = getEnv().VITE_CI === "true" || getEnv().CI === "true"

export const checkIsExtension = () => {
  if (typeof chrome !== "undefined" && chrome.runtime?.id) {
    return true
  }
  if (typeof browser !== "undefined" && (browser as any).runtime?.id) {
    return true
  }
  return false
}

export const getExtensionUrl = () => {
  if (typeof window === "undefined") return
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL("index.html") // Chrome
  }
  if (typeof browser !== "undefined" && (browser as any).runtime?.getURL) {
    return (browser as any).runtime.getURL("index.html") // Firefox
  }
  return `${window.location.origin}/index.html` // Fallback
}

export const isProduction =
  getEnv().NODE_ENV === "production" || getEnv().VITE_NODE_ENV === "production"

export const isDevelopment = checkIsExtension()
  ? [
      "jnngfghgbmieehkfebkogjjiepomakdh",
      "bikahnjnakdnnccpnmcpmiojnehfooio", // Known dev extension ID
    ].some((id) => getExtensionUrl()?.includes(id)) ||
    // Detect unpacked extensions: they have random 32-char IDs (all lowercase letters a-p)
    // Packed extensions from store have mixed case IDs
    Boolean(getExtensionUrl()?.match(/chrome-extension:\/\/[a-p]{32}\//))
  : !isProduction

export const isE2E =
  getEnv().VITE_TESTING_ENV === "e2e" || getEnv().TESTING_ENV === "e2e"

export const isTestingDevice = false && isDevelopment

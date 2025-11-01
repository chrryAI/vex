"use client"

/**
 * Platform Provider
 * Runtime platform detection and abstraction
 *
 * Detects platform at runtime and provides context to all components
 * No need for .native.tsx or .web.tsx files!
 */

/// <reference types="chrome" />

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  startTransition,
} from "react"
import { useCookie } from "./cookies"
import {
  type PlatformType,
  type BrowserType,
  isWeb as _isWeb,
  isNative as _isNative,
  isIOS as _isIOS,
  isAndroid as _isAndroid,
  isBrowserExtension as _isBrowserExtension,
  isStandalone as _isStandalone,
  getBrowser as _getBrowser,
  detectPlatform as _detectPlatform,
} from "./detection"

// Re-export for backwards compatibility
export type { PlatformType, BrowserType }
export {
  isWeb,
  isNative,
  isIOS,
  isAndroid,
  isBrowserExtension,
  isStandalone,
  getBrowser,
  detectPlatform,
} from "./detection"

// Get extension URL (works for Chrome, Firefox, etc.)
export const getExtensionUrl = (path: string = "index.html"): string => {
  if (typeof window === "undefined") return ""

  // Chrome/Edge extension
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path)
  }

  // Firefox extension
  if (typeof browser !== "undefined" && (browser as any).runtime?.getURL) {
    return (browser as any).runtime.getURL(path)
  }

  // Fallback to current origin
  return `${window.location.origin}/${path}`
}

// Get extension ID (useful for detecting dev vs production)
export const getExtensionId = (): string | null => {
  if (typeof window === "undefined") return null

  // Chrome/Edge extension
  if (typeof chrome !== "undefined" && chrome.runtime?.id) {
    return chrome.runtime.id
  }

  // Firefox extension
  if (typeof browser !== "undefined" && (browser as any).runtime?.id) {
    return (browser as any).runtime.id
  }

  return null
}

// ============================================
// PLATFORM CONTEXT
// ============================================

export interface PlatformContextValue {
  platform: "web" | "ios" | "android" | "extension"
  browser: BrowserType
  device: "mobile" | "tablet" | "desktop"
  os: "ios" | "android" | "macos" | "windows" | "linux" | "unknown"
  isWeb: boolean
  isNative: boolean
  isIOS: boolean
  isAndroid: boolean
  isExtension: boolean
  isStandalone: boolean
  isChrome: boolean
  isFirefox: boolean
  isSafari: boolean
  isEdge: boolean
  supportsHover: boolean
  supportsTouch: boolean
  supportsKeyboard: boolean
  supportsGestures: boolean
  supportsCamera: boolean
  supportsNotifications: boolean
  isMobile: boolean
  isTablet: boolean
  orientation: "portrait" | "landscape"
  isDesktop: boolean
  viewPortWidth: number
  viewPortHeight: number

  styleRegistry: Map<string, Record<string, any>>
  updateStyleRegistry: (newRegistry: Map<string, Record<string, any>>) => void
  BrowserInstance: typeof chrome | null

  // Server-side device detection (from UAParser)
  serverDevice?: {
    vendor?: string
    model?: string
    type?: string
  }
  serverOS?: {
    name?: string
    version?: string
  }
  serverBrowser?: {
    name?: string
    version?: string
    major?: string
  }
}

const PlatformContext = createContext<PlatformContextValue | null>(null)

// ============================================
// PLATFORM PROVIDER
// ============================================

export function PlatformProvider({
  children,
  styleModules = {},
  session,
  ...rest
}: {
  children: ReactNode
  styleModules?: Record<string, Record<string, any>>
  viewPortWidth?: string
  viewPortHeight?: string
  session?: {
    device?: { vendor?: string; model?: string; type?: string }
    os?: { name?: string; version?: string }
    browser?: { name?: string; version?: string; major?: string }
  }
}) {
  const platform = _detectPlatform()
  const browser = _getBrowser()

  // Browser-specific flags
  const isChrome = browser === "chrome"
  const isFirefox = browser === "firefox"
  const isSafari = browser === "safari"
  const isEdge = browser === "edge"

  // Feature detection
  const supportsHover = _isWeb() || _isBrowserExtension()
  const supportsTouch = true // All platforms support touch
  const supportsKeyboard = true // All platforms have keyboard
  const supportsGestures = _isNative()
  const supportsCamera = _isNative()
  const supportsNotifications = true

  // Dimensions - prioritize viewport width from props/cookies for consistent SSR/client rendering
  const [viewportWidthInternal, setViewportWidth] = React.useState<number>(
    () => {
      // Use passed prop if available (from server cookies)
      if (rest.viewPortWidth) {
        return parseInt(rest.viewPortWidth, 10)
      }
      // Fallback to window on client (initial render)
      if (typeof window !== "undefined") {
        return window.innerWidth
      }
      // Default for SSR
      return 1024
    },
  )

  const viewportWidth = parseInt(
    viewportWidthInternal.toString() ||
      rest.viewPortWidth?.toString() ||
      "1024",
  )

  // Update viewport width on client after mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const updateWidth = () => setViewportWidth(window.innerWidth)
      updateWidth() // Set immediately
      window.addEventListener("resize", updateWidth)
      return () => window.removeEventListener("resize", updateWidth)
    }
  }, [])

  const isMobile = _isNative() || (_isWeb() && viewportWidth < 600)

  // SSR-safe: Use viewport width for tablet detection instead of navigator
  const isTablet = viewportWidth >= 600 && viewportWidth < 960

  const isDesktop = _isWeb() && viewportWidth >= 960

  // Detect OS - SSR-safe: use server-side UAParser detection only
  const os: "ios" | "android" | "macos" | "windows" | "linux" | "unknown" =
    (() => {
      // Use UAParser OS detection from session
      if (session?.os?.name) {
        const osLower = session.os.name.toLowerCase()
        if (osLower.includes("ios")) return "ios"
        if (osLower.includes("android")) return "android"
        if (osLower.includes("mac")) return "macos"
        if (osLower.includes("windows")) return "windows"
        if (osLower.includes("linux")) return "linux"
      }

      // SSR fallback - return unknown instead of trying client detection
      // This prevents hydration mismatch
      return "unknown"
    })()

  // Detect device type - SSR-safe: use server-side UAParser detection only
  const device: "mobile" | "tablet" | "desktop" = (() => {
    // Use UAParser device type from session
    if (session?.device?.type === "mobile") return "mobile"
    if (session?.device?.type === "tablet") return "tablet"

    // SSR fallback - use viewport width from cookies (SSR-safe)
    // UAParser returns undefined for desktop, so use viewport as fallback
    if (viewportWidth < 600) return "mobile"
    if (viewportWidth < 960) return "tablet"
    return "desktop"
  })()

  // Create style registry from all style modules (with state for updates)
  const [styleRegistry, setStyleRegistry] = React.useState(() => {
    const registry = new Map<string, Record<string, any>>()

    // Flatten all style modules into the registry
    Object.entries(styleModules).forEach(([moduleName, styles]) => {
      Object.entries(styles).forEach(([className, styleObj]) => {
        registry.set(className, styleObj as Record<string, any>)
      })
    })

    return registry
  })

  // Function to update the registry (for useClsx)
  const updateStyleRegistry = React.useCallback(
    (newRegistry: Map<string, Record<string, any>>) => {
      setStyleRegistry(newRegistry)
    },
    [],
  )

  // Viewport dimensions with cross-platform support
  const [viewPortWidthInternal, setViewPortWidthInternal] = useCookie(
    "viewPortWidth",
    rest.viewPortWidth,
  )

  const viewPortWidth = Number(viewPortWidthInternal)

  const setViewPortWidth = (height: number) => {
    setViewPortWidthInternal(String(height))
  }
  const [viewPortHeightInternal, setViewPortHeightInternal] = useCookie(
    "viewPortHeight",
    rest.viewPortHeight,
  )

  const viewPortHeight = Number(viewPortHeightInternal)

  const setViewPortHeight = (height: number) => {
    setViewPortHeightInternal(String(height))
  }

  useEffect(() => {
    // Only run on web/extension (not native)
    if (!_isWeb() && !_isBrowserExtension()) return
    if (typeof window === "undefined") return

    const updateViewportDimensions = () => {
      // Use startTransition to make this a non-blocking update
      startTransition(() => {
        setViewPortWidth(window.innerWidth)
        setViewPortHeight(window.innerHeight)
      })
    }

    // Set initial values
    updateViewportDimensions()

    // Debounce resize to prevent excessive re-renders and Suspense triggers
    let timeoutId: NodeJS.Timeout
    const debouncedUpdate = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateViewportDimensions, 150)
    }

    // Update on resize (debounced)
    window.addEventListener("resize", debouncedUpdate, { passive: true })
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener("resize", debouncedUpdate)
    }
  }, [setViewPortWidth, setViewPortHeight])

  // Platform-specific value selector
  const select = <T,>(options: {
    web?: T
    native?: T
    ios?: T
    android?: T
    default: T
  }): T => {
    if (_isIOS() && options.ios !== undefined) return options.ios
    if (_isAndroid() && options.android !== undefined) return options.android
    if (_isNative() && options.native !== undefined) return options.native
    if (_isWeb() && options.web !== undefined) return options.web
    return options.default
  }

  // Get browser instance (Chrome/Firefox extension API)
  const BrowserInstance = (() => {
    if (typeof window === "undefined") return null
    if (typeof chrome !== "undefined" && chrome.runtime) return chrome
    // Use globalThis to avoid naming collision with the 'browser' variable above
    const firefoxBrowser = (globalThis as any).browser
    if (typeof firefoxBrowser !== "undefined" && firefoxBrowser?.runtime) {
      // Firefox's browser API is compatible with Chrome's API
      return firefoxBrowser as typeof chrome
    }
    return null
  })()

  const value: PlatformContextValue = {
    platform: platform === "native" ? "android" : platform,
    browser,
    device,
    os,
    isWeb: _isWeb(),
    isNative: _isNative(),
    isIOS: _isIOS(),
    isAndroid: _isAndroid(),
    isExtension: _isBrowserExtension(),
    isStandalone: _isStandalone(),
    isChrome,
    isFirefox,
    isSafari,
    isEdge,
    supportsHover,
    supportsTouch,
    supportsKeyboard,
    supportsGestures,
    supportsCamera,
    supportsNotifications,
    isMobile,
    isTablet,
    isDesktop,
    styleRegistry,
    updateStyleRegistry,
    BrowserInstance,
    orientation: "portrait",
    viewPortWidth,
    viewPortHeight,
    // Server-side detection data
    serverDevice: session?.device,
    serverOS: session?.os,
    serverBrowser: session?.browser,
  }

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  )
}

// ============================================
// PLATFORM HOOK
// ============================================

export function usePlatform() {
  const context = useContext(PlatformContext)

  if (!context) {
    throw new Error("usePlatform must be used within PlatformProvider")
  }

  return context
}

// ============================================
// PLATFORM HOC
// ============================================

export function withPlatform<P extends object>(
  Component: React.ComponentType<P & { platform: PlatformContextValue }>,
) {
  return function PlatformComponent(props: P) {
    const platform = usePlatform()
    return <Component {...props} platform={platform} />
  }
}

// ============================================
// PLATFORM UTILITIES
// ============================================

/**
 * Conditionally render based on platform
 */
export function PlatformSwitch({
  web,
  native,
  ios,
  android,
}: {
  web?: ReactNode
  native?: ReactNode
  ios?: ReactNode
  android?: ReactNode
}) {
  const { isIOS, isAndroid, isWeb: _isWeb } = usePlatform()

  if (isIOS && ios) return <>{ios}</>
  if (isAndroid && android) return <>{android}</>
  if (!_isWeb && native) return <>{native}</>
  if (_isWeb && web) return <>{web}</>

  return null
}

/**
 * Show only on web
 */
export function WebOnly({ children }: { children: ReactNode }) {
  const { isWeb: _isWeb } = usePlatform()
  return _isWeb ? <>{children}</> : null
}

/**
 * Show only on native
 */
export function NativeOnly({ children }: { children: ReactNode }) {
  const { isNative: _isNative } = usePlatform()
  return _isNative ? <>{children}</> : null
}

/**
 * Show only on ios
 */
export function IOSOnly({ children }: { children: ReactNode }) {
  const { isIOS: _isIOS } = usePlatform()
  return _isIOS ? <>{children}</> : null
}

/**
 * Show only on Android
 */
export function AndroidOnly({ children }: { children: ReactNode }) {
  const { isAndroid: _isAndroid } = usePlatform()
  return _isAndroid ? <>{children}</> : null
}

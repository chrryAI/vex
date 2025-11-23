"use client"

/**
 * Centralized exports for all context providers and hooks
 */

// Providers
export { ErrorProvider, useError } from "./ErrorProvider"
export { NavigationProvider, useNavigationContext } from "./NavigationProvider"
export { AuthProvider, useAuth } from "./AuthProvider"
export { ChatProvider, useChat } from "./ChatProvider"
export { DataProvider, useData } from "./DataProvider"
export { AppProvider, useApp } from "./AppProvider"
export { PlatformProvider } from "../../platform"

// Composition root - import from separate file to avoid circular dependencies
export { default } from "./AppProviders"

/**
 * Native Navigation (React Native with Solito)
 */

import React, { createContext, useContext, useMemo, useCallback } from "react"
import {
  useNavigation as useNativeNavigation,
  StackActions,
} from "@react-navigation/native"

export interface NavigationOptions {
  scroll?: boolean
  shallow?: boolean
  clientOnly?: boolean
}

export interface NavigationParams {
  searchParams: URLSearchParams
  pathname: string
  push: (path: string, options?: NavigationOptions) => void
  replace: (path: string, options?: NavigationOptions) => void
  back: () => void
  forward: () => void
  refresh: () => void
  prefetch: (path: string) => void
  addParams: (params: Record<string, string | number | boolean>) => void
  removeParams: (keys: string | string[]) => void
  setParams: (params: Record<string, string | number | boolean>) => void
}

// Context to hold the current route info
const NativeRouteContext = createContext<{
  pathname: string
  searchParams: URLSearchParams
}>({
  pathname: "/",
  searchParams: new URLSearchParams(),
})

export const NativeRouteProvider = ({
  children,
  state,
}: {
  children: React.ReactNode
  state: any
}) => {
  const value = useMemo(() => {
    if (!state) {
      return {
        pathname: "/",
        searchParams: new URLSearchParams(),
      }
    }

    const currentRoute = state.routes[state.index]

    let pathname = "/"
    if (currentRoute) {
      if (currentRoute.name === "home") pathname = "/"
      else if (currentRoute.name === "thread")
        pathname = `/threads/${currentRoute.params?.id || ""}`
      else pathname = `/${currentRoute.name}`
    }

    const searchParams = new URLSearchParams()
    if (currentRoute?.params) {
      Object.entries(currentRoute.params).forEach(([key, value]) => {
        if (key !== "id") searchParams.set(key, String(value))
      })
    }

    return { pathname, searchParams }
  }, [state])

  return React.createElement(NativeRouteContext.Provider, { value }, children)
}

// Helper to parse path into route name and params
const parsePath = (path: string) => {
  const cleanPath = path.split("?")[0] || ""
  const query = path.split("?")[1] || ""
  const searchParams = new URLSearchParams(query)
  const params: Record<string, any> = Object.fromEntries(searchParams.entries())

  if (cleanPath === "/" || cleanPath === "") {
    return { name: "home", params }
  }
  if (cleanPath.startsWith("/threads/")) {
    const id = cleanPath.split("/")[2]
    return { name: "thread", params: { ...params, id } }
  }
  if (cleanPath === "/threads") {
    return { name: "threads", params }
  }
  // Fallback for other routes - try to use the path segment as route name
  const segment = cleanPath.slice(1)
  return { name: segment, params }
}

/**
 * Native navigation hook using React Navigation
 */
export function useNavigation(): NavigationParams {
  const navigation = useNativeNavigation<any>()
  const { pathname, searchParams } = useContext(NativeRouteContext)

  const push = useCallback(
    (path: string, options?: NavigationOptions) => {
      const { name, params } = parsePath(path)
      navigation.navigate(name, params)
    },
    [navigation],
  )

  const replace = useCallback(
    (path: string, options?: NavigationOptions) => {
      const { name, params } = parsePath(path)
      navigation.dispatch(StackActions.replace(name, params))
    },
    [navigation],
  )

  const back = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    }
  }, [navigation])

  const forward = useCallback(() => {
    console.warn("Forward navigation not supported on native")
  }, [])

  const refresh = useCallback(() => {
    // No-op
  }, [])

  const prefetch = useCallback((path: string) => {
    // No-op
  }, [])

  const addParams = useCallback(
    (params: Record<string, string | number | boolean>) => {
      navigation.setParams(params)
    },
    [navigation],
  )

  const removeParams = useCallback(
    (keys: string | string[]) => {
      // React Navigation merges params, so we can't easily "remove" them without resetting
      // But we can set them to undefined/null if the screen handles it
      const keysArray = Array.isArray(keys) ? keys : [keys]
      const newParams: Record<string, any> = {}
      keysArray.forEach((key) => {
        newParams[key] = undefined
      })
      navigation.setParams(newParams)
    },
    [navigation],
  )

  const setParams = useCallback(
    (params: Record<string, string | number | boolean>) => {
      navigation.setParams(params)
    },
    [navigation],
  )

  return useMemo(
    () => ({
      searchParams,
      pathname,
      push,
      replace,
      back,
      forward,
      refresh,
      prefetch,
      addParams,
      removeParams,
      setParams,
    }),
    [
      searchParams,
      pathname,
      push,
      replace,
      back,
      forward,
      refresh,
      prefetch,
      addParams,
      removeParams,
      setParams,
    ],
  )
}

/**
 * Get current pathname (native)
 */
export function useCurrentPathname(): string {
  const { pathname } = useNavigation()
  return pathname
}

/**
 * Get search params (native)
 */
export function useCurrentSearchParams(): URLSearchParams {
  const { searchParams } = useNavigation()
  return searchParams
}

/**
 * Get previous pathname (native)
 */
export function usePreviousPathname(): string | null {
  // TODO: Implement actual history tracking if needed
  return null
}

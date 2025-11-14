import useLocalStorage from "./useLocalStorage"

import { usePlatform, useCookie } from "../platform"
import { useEffect } from "react"
export default function useCookieOrLocalStorage(
  key: string,
  initialValue: any,
  canReadCookie: boolean = false,
) {
  const { isExtension, isNative } = usePlatform()

  const [cookie, setCookieInternal] = useCookie(key, initialValue)
  const [local, setLocalInternal] = useLocalStorage(
    key,
    canReadCookie ? cookie : initialValue,
  )

  useEffect(() => {
    if (!canReadCookie) {
      return
    }

    cookie && setLocalInternal(cookie)
  }, [cookie, canReadCookie])

  // Extensions/native: read from cookie (cross-site), write to localStorage
  // Web: read and write to cookie
  const state = isExtension || isNative ? local : cookie

  const setState = (value: any) => {
    if (!isExtension && !isNative) {
      setCookieInternal(value)
    }

    setLocalInternal(value)
  }

  return [state, setState] as const
}

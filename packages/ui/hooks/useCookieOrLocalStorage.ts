import useLocalStorage from "./useLocalStorage"

import { usePlatform, useCookie } from "../platform"
export default function useCookieOrLocalStorage(
  key: string,
  initialValue: any,
) {
  const { isExtension, isNative } = usePlatform()

  const [cookie, setCookieInternal] = useCookie(key, initialValue)
  const [local, setLocalInternal] = useLocalStorage(key, initialValue)

  const state = isExtension || isNative ? local : cookie

  const setState = (value: any) => {
    if (isExtension || isNative) {
      setLocalInternal(value)
    } else {
      setCookieInternal(value)
    }
  }

  return [state, setState] as const
}

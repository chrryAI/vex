import { useEffect, useRef, useState, useCallback } from "react"

export const useUserScroll = () => {
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [hasStoppedScrolling, setHasStoppedScrolling] = useState(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isUserInitiatedRef = useRef(false)
  const lastScrollTopRef = useRef(0)
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  // ✅ Expose reset function
  const resetScrollState = useCallback(() => {
    setHasStoppedScrolling(false)
    setIsUserScrolling(false)
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = null
    }
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current)
      interactionTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleUserInteraction = () => {
      isUserInitiatedRef.current = true

      // Clear previous timeout
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current)
      }

      // iOS Safari needs longer timeout for touch scrolling
      interactionTimeoutRef.current = setTimeout(() => {
        isUserInitiatedRef.current = false
      }, 500)
    }

    const handleScroll = () => {
      const currentScrollTop =
        window.scrollY || document.documentElement.scrollTop
      const isScrollingUp = currentScrollTop < lastScrollTopRef.current
      const scrollDelta = Math.abs(currentScrollTop - lastScrollTopRef.current)
      lastScrollTopRef.current = currentScrollTop

      // Only track user-initiated scrolling
      // Ignore small programmatic scrolls (< 5px) or scrolls without user interaction
      if (isUserInitiatedRef.current && scrollDelta > 5) {
        setIsUserScrolling(true)
        setHasStoppedScrolling(false)

        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }

        scrollTimeoutRef.current = setTimeout(() => {
          setIsUserScrolling(false)
          setHasStoppedScrolling(true) // User stopped scrolling = reading
        }, 150)
      }
    }

    window.addEventListener("wheel", handleUserInteraction, { passive: true })
    window.addEventListener("touchstart", handleUserInteraction, {
      passive: true,
    })
    window.addEventListener("touchmove", handleUserInteraction, {
      passive: true,
    })
    window.addEventListener("keydown", handleUserInteraction)
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("wheel", handleUserInteraction)
      window.removeEventListener("touchstart", handleUserInteraction)
      window.removeEventListener("touchmove", handleUserInteraction)
      window.removeEventListener("keydown", handleUserInteraction)
      window.removeEventListener("scroll", handleScroll)

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  return { isUserScrolling, hasStoppedScrolling, resetScrollState }
}

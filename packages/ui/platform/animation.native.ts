/**
 * Native Animation (Moti - Motion for React Native)
 */

// Moti for React Native animations
import { MotiView, MotiText, MotiImage, MotiScrollView } from "moti"

// Re-export Moti components
export { MotiView, MotiText, MotiImage, MotiScrollView }

// Mock AnimatePresence for now (react-spring doesn't have a direct equivalent in the same way)
export const AnimatePresence = ({ children }: { children: React.ReactNode }) =>
  children

/**
 * Animate function (compatible with motion API)
 * On native, this is a simplified version
 */
export const animate = (
  target: any,
  values: Record<string, any>,
  options?: any,
) => {
  console.warn(
    "[chrry/platform/animation] animate() called on native - use Moti components instead",
  )
  // Return a mock animation control
  return {
    stop: () => {},
    pause: () => {},
    play: () => {},
    cancel: () => {},
  }
}

/**
 * Stagger function (compatible with motion API)
 * On native, returns a simple delay calculator
 */
export const stagger = (delay: number = 0.1, options?: any) => {
  return (index: number) => delay * index
}

/**
 * Timeline function (mock for native)
 */
export const timeline = (sequence: any[], options?: any) => {
  console.warn(
    "[chrry/platform/animation] timeline() not supported on native yet",
  )
  return {
    stop: () => {},
    pause: () => {},
    play: () => {},
  }
}

/**
 * Scroll function (mock for native)
 */
export const scroll = (options?: any) => {
  console.warn(
    "[chrry/platform/animation] scroll() not supported on native yet",
  )
  return () => {}
}

/**
 * InView function (mock for native)
 */
export const inView = (target: any, callback: any, options?: any) => {
  console.warn(
    "[chrry/platform/animation] inView() not supported on native yet",
  )
  return () => {}
}

export type AnimationOptions = Record<string, any>

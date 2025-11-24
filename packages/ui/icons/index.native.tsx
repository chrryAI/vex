/**
 * Native Icon Exports
 * Uses lucide-react-native for ios/Android environments
 */

import React from "react"
import { Glasses, EyeOff } from "lucide-react-native"

export * from "lucide-react-native"

// AI Brand Icons (simple emoji-based for React Native)
export * from "./BrandIcons.native"

// lucide-react-native doesn't export IconProps, so we define it
export type IconProps = {
  size?: number
  color?: string
  strokeWidth?: number
  fill?: string
  [key: string]: any
}

// Custom icons that don't exist in lucide-react-native
// Use Glasses as fallback for HatGlasses (incognito mode)
export const HatGlasses = Glasses

// Custom icons
export { WannathisIcon } from "./WannathisIcon"

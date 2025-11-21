/**
 * Native Icon Exports
 * Uses lucide-react-native for ios/Android environments
 */

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

// Custom icons
export { WannathisIcon } from "./WannathisIcon"

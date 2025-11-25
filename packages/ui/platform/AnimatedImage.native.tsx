/**
 * Native animated image using Moti
 */

import React from "react"
import { MotiImage } from "moti"
import type { AnimationPreset } from "./animations"

interface AnimatedImageProps {
  src: string
  alt?: string
  className?: string
  style?: any
  isLoaded: boolean
  reduceMotion: boolean | null
  onLoad?: () => void
  dataTestId?: string
  animation?: AnimationPreset
}

export function AnimatedImage({
  src,
  alt,
  style,
  isLoaded,
  reduceMotion,
  onLoad,
  dataTestId,
  animation = "fadeIn",
}: AnimatedImageProps) {
  return (
    <MotiImage
      testID={dataTestId}
      source={{ uri: src }}
      onLoad={onLoad}
      style={style}
      accessibilityLabel={alt}
      from={{
        opacity: 0,
        translateY: reduceMotion ? 0 : 30,
      }}
      animate={{
        opacity: isLoaded ? 1 : 0,
        translateY: 0,
      }}
      transition={{
        type: reduceMotion ? "timing" : "spring",
        duration: reduceMotion ? 0 : 300,
      }}
    />
  )
}

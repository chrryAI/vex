/**
 * Native animated image using React Native's built-in Animated API
 */

import React, { useEffect, useRef } from "react"
import { Image, Animated } from "react-native"
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

const AnimatedImageComponent = Animated.createAnimatedComponent(Image)

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
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(30)).current

  useEffect(() => {
    if (isLoaded) {
      const duration = reduceMotion ? 0 : 300
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [isLoaded, reduceMotion, opacity, translateY])

  return (
    <AnimatedImageComponent
      testID={dataTestId}
      source={{ uri: src }}
      onLoad={onLoad}
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
      accessibilityLabel={alt}
    />
  )
}

import React from "react"
import { View, StyleSheet } from "react-native"

export interface VideoProps {
  src: string
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  playsInline?: boolean
  controls?: boolean
  style?: any
  className?: string
  width?: number | string
  height?: number | string
}

const Video: React.FC<VideoProps> = ({ style, width, height }) => {
  // React Native doesn't have built-in video support
  // You would need to use expo-av or react-native-video
  // For now, return a placeholder View
  return (
    <View
      style={[
        styles.placeholder,
        style,
        width && { width },
        height && { height },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: "#000",
    borderRadius: 8,
  },
})

export default Video

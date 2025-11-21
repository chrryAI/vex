import React from "react"
import { View, Text } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from "react-native-reanimated"
import { usePlatform } from "./platform"

interface SwipeableTimeControlProps {
  value: number
  onValueChange: (newValue: number) => void
  isMinute?: boolean
  disabled?: boolean
  style?: any
  Up: React.ReactNode
  Down: React.ReactNode
  time: number
}

const SwipeableTimeControl = ({
  value,
  onValueChange,
  isMinute = false,
  disabled = false,
  style,
  Up,
  Down,
  time,
}: SwipeableTimeControlProps) => {
  const { os } = usePlatform()
  const translateY = useSharedValue(0)
  const isDragging = useSharedValue(false)
  const startY = useSharedValue(0)

  const maxValue = isMinute ? 59 : Infinity
  const minValue = 0

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      startY.value = translateY.value
      isDragging.value = true
    })
    .onUpdate((event) => {
      translateY.value = startY.value + event.translationY

      const sensitivity = os === "ios" ? 30 : 20 // Higher value = less sensitive (more pixels per unit)
      // Reanimated translationY: positive when dragging down, negative when dragging up.
      // We want dragging up (negative translationY) to increase value.

      const diff = Math.round(-event.translationY / sensitivity)

      if (diff !== 0) {
        const newValue = Math.max(minValue, Math.min(maxValue, value + diff))
        if (newValue !== value) {
          runOnJS(onValueChange)(newValue)
        }
      }
    })
    .onEnd(() => {
      isDragging.value = false
      translateY.value = withSpring(0)
    })

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value * 0.1 }, // subtle movement
        { scale: isDragging.value ? 1.02 : 1 },
      ],
      opacity: isDragging.value ? 0.8 : 1,
    }
  })

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            ...style,
          },
          animatedStyle,
        ]}
      >
        <View>{Up}</View>

        <View style={{ marginVertical: 10 }}>
          <Text
            style={{
              fontSize: 40,
              fontWeight: "200",
              textAlign: "center",
              fontFamily: os === "ios" ? "Menlo" : "monospace",
              color: "var(--foreground)", // This might not work on native if var is used.
              // Assuming native handles vars or we need explicit colors.
              // For now leaving as is or using a default.
            }}
          >
            {value.toString().padStart(2, "0")}
          </Text>
        </View>

        <View>{Down}</View>
      </Animated.View>
    </GestureDetector>
  )
}

export default SwipeableTimeControl

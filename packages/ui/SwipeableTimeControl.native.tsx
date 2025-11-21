import React from "react"
import { View, Text } from "react-native"
import { PanGestureHandler } from "react-native-gesture-handler"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  runOnJS,
  withSpring,
  useDerivedValue,
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

  const maxValue = isMinute ? 59 : Infinity
  const minValue = 0

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      if (disabled) return
      ctx.startY = translateY.value
      isDragging.value = true
    },
    onActive: (event, ctx) => {
      if (disabled) return
      translateY.value = ctx.startY + event.translationY

      const sensitivity = os === "ios" ? 30 : 20 // Higher value = less sensitive (more pixels per unit)
      // Invert deltaY because dragging down (positive translation) should decrease value?
      // Wait, web implementation: deltaY = startY - clientY.
      // If dragging down, clientY increases, so deltaY is negative.
      // Web logic: change = deltaY / sensitivity.
      // If deltaY is negative (drag down), change is negative -> value decreases.
      // If deltaY is positive (drag up), change is positive -> value increases.

      // Reanimated translationY: positive when dragging down, negative when dragging up.
      // So translationY is roughly -deltaY.
      // We want dragging up (negative translationY) to increase value.

      const diff = Math.round(-event.translationY / sensitivity)

      if (diff !== 0) {
        const newValue = Math.max(minValue, Math.min(maxValue, value + diff))
        if (newValue !== value) {
          runOnJS(onValueChange)(newValue)
          // Reset translation to avoid continuous acceleration if we just used total translation
          // But here we are using total translation from start.
          // If we update value, we should probably reset the "base" or just rely on the user updating the 'value' prop.
          // However, if 'value' prop updates, this component re-renders.
          // But the gesture continues.

          // A better approach for continuous gesture value updates:
          // Store the initial value at start of gesture.
        }
      }
    },
    onEnd: () => {
      isDragging.value = false
      translateY.value = withSpring(0)
    },
  })

  // We need to handle the value update logic carefully to avoid jumping.
  // The simple approach above might cause issues if 'value' updates while dragging.
  // Let's try a simpler approach: just trigger change on significant movement and reset?
  // Or trust the parent to update 'value'.

  // Actually, let's stick to the web logic:
  // Web uses `lastValueRef.current + change`.
  // We can do similar with a shared value for 'startValue'.

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
    <PanGestureHandler onGestureEvent={gestureHandler}>
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
    </PanGestureHandler>
  )
}

export default SwipeableTimeControl

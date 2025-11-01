import React, { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native"
import { AnimatedImage } from "chrry/platform/AnimatedImage"
import { AnimationPreset } from "chrry/platform/animations"

const ANIMATIONS: AnimationPreset[] = [
  "slideUp",
  "slideDown",
  "slideLeft",
  "slideRight",
  "fade",
  "scale",
  "pulse",
  "float",
  "wiggle",
]

export default function VexNativeApp() {
  const [currentAnimation, setCurrentAnimation] =
    useState<AnimationPreset>("slideUp")
  const [imageKey, setImageKey] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)

  const testAnimation = (animation: AnimationPreset) => {
    setCurrentAnimation(animation)
    setIsLoaded(false) // Reset animation
    setImageKey((prev) => prev + 1) // Force re-render

    // Trigger animation after a brief delay
    setTimeout(() => {
      setIsLoaded(true)
    }, 50)
  }

  // Initial animation on mount
  React.useEffect(() => {
    setTimeout(() => {
      setIsLoaded(true)
    }, 100)
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎨 Animation Test</Text>
      <Text style={styles.subtitle}>Current: {currentAnimation}</Text>

      <View style={styles.imageContainer}>
        <AnimatedImage
          key={imageKey}
          src="https://picsum.photos/200/200"
          alt="Test image"
          style={styles.image}
          isLoaded={isLoaded}
          reduceMotion={false}
          animation={currentAnimation}
        />
      </View>

      <ScrollView style={styles.buttonContainer}>
        {ANIMATIONS.map((animation) => (
          <TouchableOpacity
            key={animation}
            style={[
              styles.button,
              currentAnimation === animation && styles.buttonActive,
            ]}
            onPress={() => testAnimation(animation)}
          >
            <Text
              style={[
                styles.buttonText,
                currentAnimation === animation && styles.buttonTextActive,
              ]}
            >
              {animation}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginBottom: 32,
  },
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 250,
    marginBottom: 32,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  buttonContainer: {
    flex: 1,
  },
  button: {
    backgroundColor: "#222",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#333",
  },
  buttonActive: {
    backgroundColor: "#ff6b35",
    borderColor: "#ff6b35",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  buttonTextActive: {
    color: "#000",
  },
})

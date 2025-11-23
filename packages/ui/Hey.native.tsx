import React from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import Home from "./Home"
import Thread from "./Thread"
import { useAuth } from "./context/providers/AuthProvider"
import { Div } from "./platform"
import Img from "./Image"

const Stack = createNativeStackNavigator()

export const Hey = ({ children }: { children?: React.ReactNode }) => {
  const { app } = useAuth()

  // We can add splash screen logic here if needed, similar to Hey.tsx
  // For now, let's just render the navigator

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" component={Home} />
      <Stack.Screen name="thread" component={Thread} />
      {/* We can add more screens here as we migrate them */}
    </Stack.Navigator>
  )
}

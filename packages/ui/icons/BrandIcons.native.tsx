/**
 * AI Brand Icon Components for React Native
 *
 * Simple text-based placeholders for AI brand logos
 * These avoid the dependency issues with @lobehub/icons
 */

import React from "react"
import { Text } from "react-native"

interface IconProps {
  size?: number
  color?: string
}

export const DeepSeek = ({ size = 24, color = "#000" }: IconProps) => (
  <Text style={{ fontSize: size, color }}>🤖</Text>
)

export const OpenAI = ({ size = 24, color = "#000" }: IconProps) => (
  <Text style={{ fontSize: size, color }}>✨</Text>
)

export const Claude = ({ size = 24, color = "#000" }: IconProps) => (
  <Text style={{ fontSize: size, color }}>🧠</Text>
)

export const Gemini = ({ size = 24, color = "#000" }: IconProps) => (
  <Text style={{ fontSize: size, color }}>💎</Text>
)

export const Flux = ({ size = 24, color = "#000" }: IconProps) => (
  <Text style={{ fontSize: size, color }}>🎨</Text>
)

export const Perplexity = ({ size = 24, color = "#000" }: IconProps) => (
  <Text style={{ fontSize: size, color }}>🔍</Text>
)

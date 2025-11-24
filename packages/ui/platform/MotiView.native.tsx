import React from "react"
import { MotiView as MotiViewOriginal } from "moti"
import type { MotiProps } from "moti"

/**
 * Native MotiView wrapper
 * Uses the actual Moti library for React Native animations
 */
export const MotiView: typeof MotiViewOriginal = MotiViewOriginal

export type MotiViewProps = MotiProps<any>

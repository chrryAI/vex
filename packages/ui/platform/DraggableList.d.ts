import React from "react"

export interface RenderItemParams<T> {
  item: T
  index: number
  drag: (event?: any) => void
  isActive: boolean
}

export interface DraggableListProps<T> {
  data: T[]
  renderItem: (params: RenderItemParams<T>) => React.ReactElement
  keyExtractor: (item: T, index: number) => string
  onDragEnd: (params: { data: T[]; from: number; to: number }) => void
  ListHeaderComponent?: React.ReactNode
  ListFooterComponent?: React.ReactNode
  contentContainerStyle?: any
  style?: any
  testID?: string
  // Native-specific props (ignored on web)
  activationDistance?: number
  dragItemOverflow?: boolean
  dragHitSlop?: { top: number; bottom: number; left: number; right: number }
}

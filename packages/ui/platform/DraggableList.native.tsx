import React from "react"
import DraggableFlatList, {
  RenderItemParams as NativeRenderItemParams,
} from "react-native-draggable-flatlist"
import { DraggableListProps, RenderItemParams } from "./DraggableList.d"

export default function DraggableList<T>({
  data,
  renderItem,
  keyExtractor,
  onDragEnd,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
  style,
  testID,
  activationDistance,
  dragItemOverflow,
  dragHitSlop,
}: DraggableListProps<T>) {
  const renderItemWrapper = ({
    item,
    drag,
    isActive,
    index,
  }: NativeRenderItemParams<T>) => {
    // Map native params to our shared interface
    // They are identical, but explicit mapping ensures type safety
    const params: RenderItemParams<T> = {
      item,
      drag,
      isActive,
      index: index || 0,
    }
    return renderItem(params)
  }

  return (
    <DraggableFlatList
      data={data}
      renderItem={renderItemWrapper}
      keyExtractor={keyExtractor}
      onDragEnd={onDragEnd}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      contentContainerStyle={contentContainerStyle}
      style={style}
      testID={testID}
      activationDistance={activationDistance}
      dragItemOverflow={dragItemOverflow}
      dragHitSlop={dragHitSlop}
    />
  )
}

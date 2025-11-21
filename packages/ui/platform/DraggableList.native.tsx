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
    getIndex,
  }: NativeRenderItemParams<T>) => {
    // Map native params to our shared interface
    const params: RenderItemParams<T> = {
      item,
      drag,
      isActive,
      index: getIndex?.() ?? 0,
    }
    return renderItem(params)
  }

  // Wrap header/footer if they're ReactNode but not components
  const wrappedHeader =
    ListHeaderComponent &&
    typeof ListHeaderComponent !== "function" &&
    typeof ListHeaderComponent !== "object"
      ? () => <>{ListHeaderComponent}</>
      : (ListHeaderComponent as any)

  const wrappedFooter =
    ListFooterComponent &&
    typeof ListFooterComponent !== "function" &&
    typeof ListFooterComponent !== "object"
      ? () => <>{ListFooterComponent}</>
      : (ListFooterComponent as any)

  return (
    <DraggableFlatList
      data={data}
      renderItem={renderItemWrapper}
      keyExtractor={keyExtractor}
      onDragEnd={onDragEnd}
      ListHeaderComponent={wrappedHeader}
      ListFooterComponent={wrappedFooter}
      contentContainerStyle={contentContainerStyle}
      style={style}
      testID={testID}
      activationDistance={activationDistance}
      dragItemOverflow={dragItemOverflow}
      dragHitSlop={dragHitSlop}
    />
  )
}

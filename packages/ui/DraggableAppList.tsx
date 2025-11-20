import { useCallback } from "react"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { Div } from "./platform"

interface DraggableAppListProps {
  children: React.ReactNode
  onReorder?: (dragIndex: number, hoverIndex: number) => void
  style?: React.CSSProperties
}

export function DraggableAppList({
  children,
  onReorder,
  style,
}: DraggableAppListProps): React.ReactElement {
  const handleDrop = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      if (onReorder) {
        onReorder(dragIndex, hoverIndex)
      }
    },
    [onReorder],
  )

  return (
    <DndProvider backend={HTML5Backend}>
      <Div style={style} data-dnd-list>
        {children}
      </Div>
    </DndProvider>
  )
}

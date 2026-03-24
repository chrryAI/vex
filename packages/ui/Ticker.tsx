import React from "react"
import { useApp, useAuth } from "./context/providers"
import { COLORS, useTheme } from "./context/ThemeContext"
import TextType from "./TextType"
import { useAppContext } from "./context/AppContext"

function Ticker({ style }: { style?: React.CSSProperties }) {
  const { instructions } = useApp()
  const { colorScheme } = useTheme()
  const { setSelectedInstruction } = useAuth()
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const { t } = useAppContext()

  // Map instructions to their titles for the typing effect
  const instructionTitles = React.useMemo(() => {
    return (instructions || []).map(
      (ins) => `${ins.emoji ? ins.emoji + "  " : ""}${t(ins.title)}`,
    )
  }, [instructions])

  if (!instructionTitles.length) return null

  return (
    <TextType
      className="ticker-clickable"
      style={{
        fontSize: ".95rem",
        cursor: "pointer",
        color: (COLORS as any)[colorScheme] || COLORS.blue,
        ...style,
      }}
      text={instructionTitles}
      typingSpeed={40}
      pauseDuration={800}
      showCursor
      cursorCharacter="_"
      deletingSpeed={20}
      onIndexChange={setCurrentIndex}
      onClick={() => {
        if (instructions && instructions[currentIndex]) {
          setSelectedInstruction(instructions[currentIndex])
        }
      }}
    />
  )
}

export default Ticker

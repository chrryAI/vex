import React, { useEffect, useState } from "react"
import { useAppContext } from "./context/AppContext"
import { useApp, useAuth } from "./context/providers"
import { COLORS, useTheme } from "./context/ThemeContext"
import TextType from "./TextType"
import { decodeHtmlEntities, getInstructionConfig } from "./utils"

function Ticker({
  style,
  showControls = false,
  ...props
}: {
  style?: React.CSSProperties
  paused?: boolean
  showControls?: boolean
}) {
  const { instructions } = useApp()
  const { colorScheme } = useTheme()
  const {
    setSelectedInstruction,
    user,
    guest,
    weather,
    tickerPaused: paused,
    setTickerPaused,
  } = useAuth()
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const { t } = useAppContext()
  const city = user?.city || guest?.city
  const country = user?.country || guest?.country
  const [instructionConfig, setInstructionConfig] = useState(
    getInstructionConfig({
      city,
      country,
      weather,
    }),
  )

  useEffect(() => {
    setInstructionConfig(
      getInstructionConfig({
        city,
        country,
        weather,
      }),
    )
  }, [city, country, weather])
  // Map instructions to their titles for the typing effect
  const instructionTitles = React.useMemo(() => {
    return (instructions || []).map(
      (instruction) =>
        `${instruction.emoji} ${decodeHtmlEntities(t(instruction.title, instructionConfig))}`,
    )
  }, [instructions, instructionConfig])

  if (!instructionTitles.length) return null

  return (
    <TextType
      showControls={showControls}
      className="ticker-clickable"
      style={{
        fontSize: ".85rem",
        cursor: "pointer",
        color: COLORS.blue,
        fontFamily: "var(--font-mono)",
        ...style,
      }}
      onPause={() => {
        setTickerPaused(true)
      }}
      text={instructionTitles}
      typingSpeed={40}
      pauseDuration={800}
      showCursor
      cursorCharacter="_"
      deletingSpeed={20}
      onIndexChange={setCurrentIndex}
      paused={paused}
      onClick={() => {
        if (instructions?.[currentIndex]) {
          setSelectedInstruction(instructions[currentIndex])
        }
      }}
    />
  )
}

export default Ticker

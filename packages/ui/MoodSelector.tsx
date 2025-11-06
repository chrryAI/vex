"use client"

import React, { useEffect, useState } from "react"
import styles from "./MoodSelector.module.scss"
import clsx from "clsx"
import { PiHandTap } from "react-icons/pi"
import { MousePointerClick } from "lucide-react"
import { Mood, emojiMap } from "./Moodify"
import { useTranslation } from "react-i18next"

export default function MoodSelector({
  onMoodChange,
  children,
  className,
  style,
  ...rest
}: {
  children?: React.ReactNode
  mood: Mood | undefined
  className?: string
  style?: React.CSSProperties
  onMoodChange: (mood: Mood | undefined) => void
}) {
  const { t } = useTranslation()
  const [mood, setMoodInternal] = useState<Mood | undefined>(rest.mood)

  const setMood = (mood: Mood | undefined) => {
    setMoodInternal(mood)
    onMoodChange(mood)
  }

  useEffect(() => {
    setMoodInternal(rest.mood)
  }, [rest.mood])

  return (
    <div style={style} className={clsx(styles.moodSelector, className)}>
      <div className={styles.emojiContainer}>
        {mood ? (
          <button
            data-testid="moodify-reset-button"
            style={{
              fontSize: style?.fontSize,
            }}
            className={clsx("link", styles.emoji)}
            onClick={() => {
              setMood(undefined)
            }}
            type="button"
          >
            {emojiMap[mood]}
            {children ? (
              <div className={styles.children}>{children}</div>
            ) : (
              <span className={styles.edit}>{t("Edit")}</span>
            )}
          </button>
        ) : (
          <>
            <button
              style={{
                fontSize: style?.fontSize,
              }}
              type="button"
              data-testid="moodify-happy-button"
              className={clsx("link", styles.emoji)}
              onClick={() => setMood("happy")}
            >
              {emojiMap["happy"]}
            </button>
            <button
              style={{
                fontSize: style?.fontSize,
              }}
              type="button"
              data-testid="moodify-sad-button"
              className={clsx("link", styles.emoji)}
              onClick={() => setMood("sad")}
            >
              {emojiMap["sad"]}
            </button>
            <button
              style={{
                fontSize: style?.fontSize,
              }}
              type="button"
              data-testid="moodify-angry-button"
              className={clsx("link", styles.emoji)}
              onClick={() => setMood("angry")}
            >
              {emojiMap["angry"]}
            </button>
            <button
              style={{
                fontSize: style?.fontSize,
              }}
              type="button"
              data-testid="moodify-astonished-button"
              className={clsx("link", styles.emoji)}
              onClick={() => setMood("astonished")}
            >
              {emojiMap["astonished"]}
            </button>
            <button
              style={{
                fontSize: style?.fontSize,
              }}
              type="button"
              data-testid="moodify-inlove-button"
              className={clsx("link", styles.emoji)}
              onClick={() => setMood("inlove")}
            >
              {emojiMap["inlove"]}
            </button>

            <button
              style={{
                fontSize: style?.fontSize,
              }}
              type="button"
              data-testid="moodify-thinking-button"
              className={clsx("link", styles.emoji)}
              onClick={() => setMood("thinking")}
            >
              <>
                <PiHandTap strokeWidth={1.5} className={styles.mobile} />
                <MousePointerClick
                  strokeWidth={1.5}
                  className={styles.desktop}
                />
              </>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

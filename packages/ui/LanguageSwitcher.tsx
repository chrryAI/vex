"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useAppContext } from "./context/AppContext"
import { useAuth } from "./context/providers"
import { useStyles } from "./context/StylesContext"
import { CircleCheck, Languages } from "./icons"
import { useLanguageSwitcherStyles } from "./LanguageSwitcher.styles"
import { LANGUAGES, type locale, type locales } from "./locales"
import Modal from "./Modal"
import { Button, Div } from "./platform"
import { apiFetch } from "./utils"
import { ANALYTICS_EVENTS } from "./utils/analyticsEvents"

const LanguageSwitcher = ({
  style,
  multi,
  children,
  languages = LANGUAGES,
  handleSetLanguages,
}: {
  multi?: boolean
  languages?: typeof LANGUAGES
  children?: React.ReactNode
  style?: React.CSSProperties
  handleSetLanguages?: (languages: locale[]) => void
}) => {
  const { t } = useAppContext()
  const styles = useLanguageSwitcherStyles()

  const { utilities } = useStyles()

  const { language, setLanguage, user, token, plausible, API_URL } = useAuth()
  const [selected, setSelected] = useState<typeof locales>(["en"])

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  const changeLanguage = (newLocale: locale) => {
    if (multi) {
      const result = selected.includes(newLocale)
        ? selected.filter((l) => l !== newLocale)
        : selected.concat(newLocale)

      handleSetLanguages?.(result)

      setSelected(result)

      return
    }

    plausible({
      name: ANALYTICS_EVENTS.LANGUAGE_SWITCHER,
      props: {
        language: newLocale,
      },
    })
    setLanguage(newLocale)
    setIsModalOpen(false)
  }

  useEffect(() => {
    if (user && user.language !== language && token) {
      ;(async () => {
        const _result = await apiFetch(`${API_URL}/user`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...user, language }),
        })
      })()
    }
  }, [user, language, token])

  return (
    <>
      <Button
        className="link"
        style={{ ...utilities.link.style, ...style }}
        onClick={() => {
          setIsModalOpen(true)
        }}
      >
        <Languages size={18} />
      </Button>
      <Modal
        isModalOpen={isModalOpen}
        title={
          <>
            <Languages size={18} /> {t("Language")}
          </>
        }
        hasCloseButton
        onToggle={(open) => {
          setIsModalOpen(open)
        }}
        event={{
          name: "language_switcher",
        }}
      >
        <Div style={styles.languages.style}>
          {languages.map((item) => (
            <Button
              disabled={multi ? item.code === "en" : undefined}
              key={item.code}
              style={{
                ...utilities.link.style,
                ...styles.languageButton.style,
                color: multi
                  ? selected.includes(item.code)
                    ? "var(--shade-8)"
                    : undefined
                  : item.code === language
                    ? "var(--shade-8)"
                    : "",
              }}
              onClick={() => changeLanguage(item.code)}
              className={"link"}
            >
              {multi && selected.includes(item.code) && (
                <CircleCheck size={18} />
              )}
              {item.name}
            </Button>
          ))}
        </Div>
        {children}
      </Modal>
    </>
  )
}

export default LanguageSwitcher

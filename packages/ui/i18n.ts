import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import ja from "./locales/ja.json"
import es from "./locales/es.json"
import pt from "./locales/pt.json"
import de from "./locales/de.json"
import fr from "./locales/fr.json"
import ko from "./locales/ko.json"
import zh from "./locales/zh.json"
import nl from "./locales/nl.json"
import tr from "./locales/tr.json"

import { locales, locale, LANGUAGES } from "./locales"
import { storage } from "./platform/storage"
import { getCookieSync } from "./platform/cookies"
import { BrowserInstance } from "./utils"

// Cross-platform function to get locale from URL
const getLocaleFromUrl = (): string | null => {
  if (typeof window === "undefined") return null
  try {
    const pathSegments = window.location.pathname.split("/").filter(Boolean)
    const possibleLocale = pathSegments[0] as locale
    return possibleLocale && locales.includes(possibleLocale)
      ? possibleLocale
      : null
  } catch {
    return null
  }
}

// Cross-platform function to get browser language
const getBrowserLanguage = (): string | undefined => {
  if (typeof navigator === "undefined") return undefined
  try {
    return navigator.language.split("-")[0]
  } catch {
    return undefined
  }
}

const urlLang = getLocaleFromUrl()
const cookieLang = getCookieSync("NEXT_LOCALE")
let savedLang: string | null = null

try {
  savedLang = storage.getItem("language")
} catch (error) {
  console.log("Error reading language from storage:", error)
}

// Priority: URL > NEXT_LOCALE cookie > storage > browser language > default 'en'
const lang = (urlLang ||
  cookieLang ||
  savedLang ||
  getBrowserLanguage() ||
  "en") as string

const safeLang = LANGUAGES.some((x) => x.code === lang) ? lang : "en"

// Save to cross-platform storage
// try {
//   if (typeof BrowserInstance !== "undefined") {
//     BrowserInstance?.storage?.local?.set?.({ language: safeLang })
//   }
//   // Extension-specific storage (if available)
// } catch (error) {
//   console.log("Error saving language to storage:", error)
// }

// Simple i18next configuration for the extension

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
    ja: { translation: ja },
    es: { translation: es },
    pt: { translation: pt },
    de: { translation: de },
    fr: { translation: fr },
    ko: { translation: ko },
    nl: { translation: nl },
    tr: { translation: tr },
  },
  debug: false && process.env.NODE_ENV === "development",
  lng: safeLang,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already does escaping
  },
  react: {
    useSuspense: false, // Disable suspense for extension environment
  },
})

export function i18nReady() {
  return new Promise<void>((resolve) => {
    if (i18n.isInitialized) {
      resolve()
    } else {
      i18n.on("initialized", () => resolve())
    }
  })
}

export default i18n

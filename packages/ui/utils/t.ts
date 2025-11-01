import en from "../locales/en.json"
import ja from "../locales/ja.json"
import es from "../locales/es.json"
import pt from "../locales/pt.json"
import de from "../locales/de.json"
import fr from "../locales/fr.json"
import ko from "../locales/ko.json"
import zh from "../locales/zh.json"
import nl from "../locales/nl.json"
import tr from "../locales/tr.json"
import { locale } from "../locales"

export const t = (key: string, locale: locale | string) => {
  const result = key
  switch (locale) {
    case "en":
      return en[key as keyof typeof en] || result
    case "ja":
      return ja[key as keyof typeof ja] || result
    case "es":
      return es[key as keyof typeof es] || result
    case "pt":
      return pt[key as keyof typeof pt] || result
    case "de":
      return de[key as keyof typeof de] || result
    case "fr":
      return fr[key as keyof typeof fr] || result
    case "ko":
      return ko[key as keyof typeof ko] || result
    case "zh":
      return zh[key as keyof typeof zh] || result
    case "nl":
      return nl[key as keyof typeof nl] || result
    case "tr":
      return tr[key as keyof typeof tr] || result
    default:
      return result
  }
}

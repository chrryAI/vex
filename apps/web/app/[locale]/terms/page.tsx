import React from "react"
import Terms from "chrry/Terms"
import { getMetadata } from "../../../utils"
import { locale } from "chrry/locales"
import { getLocale } from "next-intl/server"

const translations = {
  en: {
    title: "Terms of Use | Vex",
    description: "Terms of Use for Vex AI Assistant",
  },
  de: {
    title: "Nutzungsbedingungen | Vex",
    description: "Nutzungsbedingungen für den Vex KI-Assistenten",
  },
  fr: {
    title: "Conditions d'Utilisation | Vex",
    description: "Conditions d'utilisation de l'assistant IA Vex",
  },
  ja: {
    title: "利用規約 | Vex",
    description: "Vex AIアシスタントの利用規約",
  },
  ko: {
    title: "이용 약관 | Vex",
    description: "Vex AI 어시스턴트 이용 약관",
  },
  pt: {
    title: "Termos de Uso | Vex",
    description: "Termos de uso do Assistente de IA Vex",
  },
  es: {
    title: "Términos de Uso | Vex",
    description: "Términos de uso del Asistente de IA Vex",
  },
  zh: {
    title: "服务条款 | Vex",
    description: "Vex AI助手的服务条款",
  },
  nl: {
    title: "Servicevoorwaarden | Vex",
    description: "Servicevoorwaarden voor de Vex AI-assistent",
  },
  tr: {
    title: "Hizmet Şartları | Vex",
    description: "Vex AI Asistanı için Hizmet Şartları",
  },
}

export const generateMetadata = async () => {
  const locale = (await getLocale()) as locale
  const t = translations[locale] || translations.en

  return getMetadata({
    title: t.title,
    description: t.description,
    locale,
  })
}

export default function TermsPage() {
  return <Terms />
}

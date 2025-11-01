import React from "react"
import Privacy from "chrry/Privacy"
import { getMetadata } from "../../../utils"
import { locale } from "chrry/locales"
import { getLocale } from "next-intl/server"

const translations = {
  en: {
    title: "Privacy Policy | Vex",
    description: "Privacy Policy for Vex AI Assistant",
  },
  de: {
    title: "Datenschutzrichtlinie | Vex",
    description: "Datenschutzrichtlinie für den Vex KI-Assistenten",
  },
  fr: {
    title: "Politique de Confidentialité | Vex",
    description: "Politique de confidentialité pour l'assistant IA Vex",
  },
  ja: {
    title: "プライバシーポリシー | Vex",
    description: "Vex AIアシスタントのプライバシーポリシー",
  },
  ko: {
    title: "개인정보 처리방침 | Vex",
    description: "Vex AI 어시스턴트의 개인정보 처리방침",
  },
  pt: {
    title: "Política de Privacidade | Vex",
    description: "Política de Privacidade para o Assistente de IA Vex",
  },
  es: {
    title: "Política de Privacidad | Vex",
    description: "Política de privacidad del Asistente de IA Vex",
  },
  zh: {
    title: "隐私政策 | Vex",
    description: "Vex AI助手的隐私政策",
  },
  nl: {
    title: "Privacybeleid | Vex",
    description: "Privacybeleid voor de Vex AI-assistent",
  },
  tr: {
    title: "Gizlilik Politikası | Vex",
    description: "Vex AI Asistanı için Gizlilik Politikası",
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

export default function PrivacyPage() {
  return <Privacy />
}

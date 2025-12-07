import React from "react"
import About from "chrry/about"
import { useLocale } from "next-intl"
import { getMetadata } from "../../../utils"
import { locale } from "chrry/locales"
import { getLocale } from "next-intl/server"

const translations = {
  en: {
    title: "About Vex | AI Assistant",
    description:
      "Learn about Vex AI Assistant, our mission, and upcoming features",
  },
  de: {
    title: "Über Vex | KI-Assistent",
    description:
      "Erfahren Sie mehr über den Vex KI-Assistenten, unsere Mission und kommende Funktionen",
  },
  fr: {
    title: "À propos de Vex | Assistant IA",
    description:
      "Découvrez l'assistant IA Vex, notre mission et les fonctionnalités à venir",
  },
  ja: {
    title: "Vexについて | AIアシスタント",
    description: "Vex AIアシスタントの概要、ミッション、今後の機能について",
  },
  ko: {
    title: "Vex 소개 | AI 어시스턴트",
    description: "Vex AI 어시스턴트, 우리의 미션, 향후 기능에 대해 알아보세요",
  },
  pt: {
    title: "Sobre o Vex | Assistente de IA",
    description:
      "Saiba mais sobre o Assistente de IA Vex, nossa missão e recursos futuros",
  },
  es: {
    title: "Acerca de Vex | Asistente de IA",
    description:
      "Conozca más sobre el Asistente de IA Vex, nuestra misión y próximas funcionalidades",
  },
  zh: {
    title: "关于Vex | AI助手",
    description: "了解Vex AI助手、我们的使命和即将推出的功能",
  },
  nl: {
    title: "Over Vex | AI-assistent",
    description:
      "Lees meer over de Vex AI-assistent, onze missie en aankomende functies",
  },
  tr: {
    title: "Vex Hakkında | AI Asistan",
    description:
      "Vex AI Asistanı, misyonumuz ve gelecek özellikler hakkında bilgi edinin",
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

export default function AboutPage() {
  const locale = useLocale()
  return <About />
}

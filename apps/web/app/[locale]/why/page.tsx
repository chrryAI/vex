import React from "react"
import Why from "chrry/Why"
import { getLocale } from "next-intl/server"
import { locale } from "chrry/locales"
import { getMetadata } from "../../../utils"

const translations = {
  en: {
    title: "Why Vex | AI Assistant",
    description:
      "Discover why Vex AI Assistant is the best choice for your AI chat needs",
  },
  de: {
    title: "Warum Vex | KI-Assistent",
    description:
      "Entdecken Sie, warum der Vex KI-Assistent die beste Wahl für Ihre KI-Chat-Anforderungen ist",
  },
  fr: {
    title: "Pourquoi Vex | Assistant IA",
    description:
      "Découvrez pourquoi l'assistant IA Vex est le meilleur choix pour vos besoins de chat IA",
  },
  ja: {
    title: "Vexが選ばれる理由 | AIアシスタント",
    description:
      "Vex AIアシスタントがAIチャットのニーズに最適な選択肢である理由を発見してください",
  },
  ko: {
    title: "Vex를 선택해야 하는 이유 | AI 어시스턴트",
    description:
      "Vex AI 어시스턴트가 AI 채팅 요구 사항에 가장 적합한 선택인 이유를 알아보세요",
  },
  pt: {
    title: "Por que Vex | Assistente de IA",
    description:
      "Descubra por que o Assistente de IA Vex é a melhor escolha para suas necessidades de chat com IA",
  },
  es: {
    title: "¿Por qué Vex? | Asistente de IA",
    description:
      "Descubra por qué el Asistente de IA Vex es la mejor opción para sus necesidades de chat con IA",
  },
  zh: {
    title: "为什么选择Vex | AI助手",
    description: "探索为什么Vex AI助手是您AI聊天需求的最佳选择",
  },
  nl: {
    title: "Waarom Vex | AI-assistent",
    description:
      "Ontdek waarom Vex AI-assistent de beste keuze is voor uw AI-chatbehoeften",
  },
  tr: {
    title: "Neden Vex | AI Asistan",
    description:
      "Vex AI Asistanı'nın AI sohbet ihtiyaçlarınız için neden en iyi seçim olduğunu keşfedin",
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
export default function WhyPage() {
  return <Why />
}

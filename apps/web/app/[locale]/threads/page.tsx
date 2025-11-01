import React from "react"
import Threads from "chrry/Threads"
import { useLocale } from "next-intl"
import { getMetadata } from "../../../utils"
import { locale } from "chrry/locales"
import { getLocale } from "next-intl/server"
import getMember from "../../actions/getMember"

const translations = {
  en: {
    title: "Threads | Vex",
    description: "Threads for Vex AI Assistant",
  },
  de: {
    title: "Threads | Vex",
    description: "Threads für den Vex KI-Assistenten",
  },
  fr: {
    title: "Threads | Vex",
    description: "Threads pour l'assistant IA Vex",
  },
  ja: {
    title: "スレッド | Vex",
    description: "Vex AIアシスタントのスレッド",
  },
  ko: {
    title: "스레드 | Vex",
    description: "Vex AI 어시스턴트의 스레드",
  },
  pt: {
    title: "Threads | Vex",
    description: "Threads para o Assistente de IA Vex",
  },
  es: {
    title: "Threads | Vex",
    description: "Threads del Asistente de IA Vex",
  },
  zh: {
    title: "线程 | Vex",
    description: "Vex AI助手的线程",
  },
  nl: {
    title: "Threads | Vex",
    description: "Threads voor de Vex AI-assistent",
  },
  tr: {
    title: "Konular | Vex",
    description: "Vex AI Asistanı için konular",
  },
}

export const generateMetadata = async () => {
  const locale = (await getLocale()) as locale
  const t = translations[locale] || translations.en

  return getMetadata({
    title: t.title,
    description: t.description,
    locale,
    robots: {
      index: false,
      follow: true,
    },
  })
}

const ThreadsPage = async ({
  params,
}: {
  params: Promise<{ userName: string }>
}) => {
  return <Threads />
}

export default ThreadsPage

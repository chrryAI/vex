import React from "react"
import Thread from "chrry/Thread"
import { useLocale } from "next-intl"
import { locale } from "chrry/locales"
import { getMetadata } from "../../../../utils"
import { getLocale } from "next-intl/server"
import { validate } from "uuid"
import { getThread } from "@repo/db"
import getMember from "../../../actions/getMember"
import getGuest from "../../../actions/getGuest"
import { notFound } from "next/navigation"

const generateTranslations = ({ title }: { title: string }) => {
  const stripped = title.substring(0, 120)

  const translations = {
    en: {
      title: `${stripped} | Vex`,
      description: "Thread for Vex AI Assistant",
    },
    de: {
      title: `${stripped} | Vex`,
      description: "Thread für den Vex KI-Assistenten",
    },
    fr: {
      title: `${stripped} | Vex`,
      description: "Thread pour l'assistant IA Vex",
    },
    ja: {
      title: `${stripped} | Vex`,
      description: "Vex AIアシスタントのスレッド",
    },
    ko: {
      title: `${stripped} | Vex`,
      description: "Vex AI 어시스턴트의 스레드",
    },
    pt: {
      title: `${stripped} | Vex`,
      description: "Thread para o Assistente de IA Vex",
    },
    es: {
      title: `${stripped} | Vex`,
      description: "Thread del Asistente de IA Vex",
    },
    zh: {
      title: `${stripped} | Vex`,
      description: "Vex AI助手的线程",
    },
    nl: {
      title: `${stripped} | Vex`,
      description: "Thread voor de Vex AI-assistent",
    },
    tr: {
      title: `${stripped} | Vex`,
      description: "Vex AI Asistanı için konu",
    },
  }

  return translations
}
export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>
}) => {
  const { id } = await params

  if (id && !validate(id)) {
    return getMetadata({
      title: "Thread | Vex",
      description: "Thread for Vex AI Assistant",
      locale: "en",
      robots: {
        index: false,
        follow: true,
      },
    })
  }

  const member = await getMember()

  const guest = !member ? await getGuest() : null

  const thread = await getThread({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })

  if (!thread) {
    return getMetadata({
      title: "Thread | Vex",
      description: "Thread for Vex AI Assistant",
      locale: "en",
    })
  }

  const locale = (await getLocale()) as locale
  const t = generateTranslations({
    title: thread.title,
  })

  return getMetadata({
    title: t[locale].title,
    description: t[locale].description,
    locale,
  })
}

export default async function ThreadPage() {
  return <Thread />
}

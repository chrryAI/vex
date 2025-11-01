import React from "react"
import Threads from "chrry/Threads"
import { useLocale } from "next-intl"
import { getMetadata } from "../../../../utils"
import { locale } from "chrry/locales"
import { getLocale } from "next-intl/server"
import getMember from "../../../actions/getMember"
import { validate, v4 as uuidv4 } from "uuid"
import { getUser } from "@repo/db"
import { notFound } from "next/navigation"
import { Metadata } from "next"

const translations = {
  en: {
    title: "Profile - Vex",
    description: "View profile and character insights",
    view: "View",
    profileAndInsights: "profile and character insights",
  },
  de: {
    title: "Profil - Vex",
    description: "Profil und Charaktereinblicke anzeigen",
    view: "Anzeigen",
    profileAndInsights: "Profil und Charaktereinblicke",
  },
  fr: {
    title: "Profil - Vex",
    description: "Voir le profil et les aperçus de caractère",
    view: "Voir",
    profileAndInsights: "profil et aperçus de caractère",
  },
  ja: {
    title: "プロフィール - Vex",
    description: "プロフィールとキャラクター洞察を表示",
    view: "表示",
    profileAndInsights: "プロフィールとキャラクター洞察",
  },
  ko: {
    title: "프로필 - Vex",
    description: "프로필 및 캐릭터 인사이트 보기",
    view: "보기",
    profileAndInsights: "프로필 및 캐릭터 인사이트",
  },
  pt: {
    title: "Perfil - Vex",
    description: "Ver perfil e insights de caráter",
    view: "Ver",
    profileAndInsights: "perfil e insights de caráter",
  },
  es: {
    title: "Perfil - Vex",
    description: "Ver perfil e insights de carácter",
    view: "Ver",
    profileAndInsights: "perfil e insights de carácter",
  },
  zh: {
    title: "个人资料 - Vex",
    description: "查看个人资料和性格洞察",
    view: "查看",
    profileAndInsights: "个人资料和性格洞察",
  },
  nl: {
    title: "Profiel - Vex",
    description: "Bekijk profiel en karakter inzichten",
    view: "Bekijk",
    profileAndInsights: "profiel en karakter inzichten",
  },
  tr: {
    title: "Profil - Vex",
    description: "Profil ve karakter görüşlerini görüntüle",
    view: "Görüntüle",
    profileAndInsights: "profil ve karakter görüşleri",
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; userName: string }>
}): Promise<Metadata> {
  const { locale, userName } = await params

  const t = translations[locale as keyof typeof translations] || translations.en

  const user = await getUser({ userName })
  const userDisplayName = user?.name || userName

  return getMetadata({
    title: `${userDisplayName} - ${t.title}`,
    description: `${t.view} ${userDisplayName}'s ${t.profileAndInsights}`,
    locale,
  })
}

const ThreadsPage = async ({
  params,
}: {
  params: Promise<{ userName: string }>
}) => {
  const { userName } = await params

  const user = await getUser({ userName })

  if (!user) {
    return notFound()
  }

  return <Threads />
}

export default ThreadsPage

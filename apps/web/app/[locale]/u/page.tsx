import React from "react"
import Users from "chrry/Users"
import { getMetadata } from "../../../utils"
import { Metadata } from "next"

const translations = {
  en: {
    title: "Users - Vex",
    description:
      "Discover users by AI-verified personality traits and character insights",
  },
  de: {
    title: "Benutzer - Vex",
    description:
      "Entdecke Benutzer durch KI-verifizierte Persönlichkeitsmerkmale und Charaktereinblicke",
  },
  fr: {
    title: "Utilisateurs - Vex",
    description:
      "Découvrez les utilisateurs par des traits de personnalité vérifiés par l'IA et des aperçus de caractère",
  },
  ja: {
    title: "ユーザー - Vex",
    description: "AI検証済みの性格特性とキャラクター洞察でユーザーを発見",
  },
  ko: {
    title: "사용자 - Vex",
    description: "AI 검증된 성격 특성과 캐릭터 인사이트로 사용자 발견",
  },
  pt: {
    title: "Usuários - Vex",
    description:
      "Descubra usuários por traços de personalidade verificados por IA e insights de caráter",
  },
  es: {
    title: "Usuarios - Vex",
    description:
      "Descubre usuarios por rasgos de personalidad verificados por IA e insights de carácter",
  },
  zh: {
    title: "用户 - Vex",
    description: "通过AI验证的性格特征和性格洞察发现用户",
  },
  nl: {
    title: "Gebruikers - Vex",
    description:
      "Ontdek gebruikers door AI-geverifieerde persoonlijkheidskenmerken en karakter inzichten",
  },
  tr: {
    title: "Kullanıcılar - Vex",
    description:
      "AI doğrulanmış kişilik özellikleri ve karakter görüşleri ile kullanıcıları keşfedin",
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = translations[locale as keyof typeof translations] || translations.en

  return getMetadata({
    title: t.title,
    description: t.description,
    locale,
  })
}

export default function UsersPage() {
  return <Users />
}

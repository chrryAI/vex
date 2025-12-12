import { locale } from "@chrryai/chrry/locales"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"

interface MetadataResult {
  title?: string
  description?: string
  keywords?: string[]
  openGraph?: {
    title?: string
    description?: string
    url?: string
    siteName?: string
    images?: Array<{
      url: string
      width?: number
      height?: number
    }>
    locale?: string
    type?: string
  }
  twitter?: {
    title?: string
    description?: string
    card?: string
    site?: string
    creator?: string
    images?: Array<{
      url: string
      width?: number
      height?: number
    }>
  }
  robots?: {
    index?: boolean
    follow?: boolean
  }
  alternates?: {
    canonical?: string
    languages?: Record<string, string>
  }
}

/**
 * Translations for static routes
 */
const aboutTranslations = {
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

const whyTranslations = {
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

const privacyTranslations = {
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

const termsTranslations = {
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

const calendarTranslations = {
  en: {
    title: "Calendar | Vex",
    description: "Manage your schedule with Vex AI Assistant",
  },
  de: {
    title: "Kalender | Vex",
    description: "Verwalten Sie Ihren Zeitplan mit dem Vex KI-Assistenten",
  },
  fr: {
    title: "Calendrier | Vex",
    description: "Gérez votre emploi du temps avec l'assistant IA Vex",
  },
  ja: {
    title: "カレンダー | Vex",
    description: "Vex AIアシスタントでスケジュールを管理",
  },
  ko: {
    title: "캘린더 | Vex",
    description: "Vex AI 어시스턴트로 일정 관리",
  },
  pt: {
    title: "Calendário | Vex",
    description: "Gerencie sua agenda com o Assistente de IA Vex",
  },
  es: {
    title: "Calendario | Vex",
    description: "Administre su agenda con el Asistente de IA Vex",
  },
  zh: {
    title: "日历 | Vex",
    description: "使用Vex AI助手管理您的日程",
  },
  nl: {
    title: "Agenda | Vex",
    description: "Beheer uw agenda met de Vex AI-assistent",
  },
  tr: {
    title: "Takvim | Vex",
    description: "Vex AI Asistanı ile programınızı yönetin",
  },
}

const affiliateTranslations = {
  en: {
    title: "Affiliate Program | Vex",
    description: "Join the Vex affiliate program and earn commissions",
  },
  de: {
    title: "Partnerprogramm | Vex",
    description:
      "Treten Sie dem Vex-Partnerprogramm bei und verdienen Sie Provisionen",
  },
  fr: {
    title: "Programme d'Affiliation | Vex",
    description:
      "Rejoignez le programme d'affiliation Vex et gagnez des commissions",
  },
  ja: {
    title: "アフィリエイトプログラム | Vex",
    description: "Vexアフィリエイトプログラムに参加してコミッションを獲得",
  },
  ko: {
    title: "제휴 프로그램 | Vex",
    description: "Vex 제휴 프로그램에 가입하고 수수료를 받으세요",
  },
  pt: {
    title: "Programa de Afiliados | Vex",
    description: "Participe do programa de afiliados Vex e ganhe comissões",
  },
  es: {
    title: "Programa de Afiliados | Vex",
    description: "Únase al programa de afiliados de Vex y gane comisiones",
  },
  zh: {
    title: "联盟计划 | Vex",
    description: "加入Vex联盟计划并赚取佣金",
  },
  nl: {
    title: "Partnerprogramma | Vex",
    description: "Word lid van het Vex-partnerprogramma en verdien commissies",
  },
  tr: {
    title: "Ortaklık Programı | Vex",
    description: "Vex ortaklık programına katılın ve komisyon kazanın",
  },
}

const usersTranslations = {
  en: {
    title: "Users | Vex",
    description: "Explore Vex AI Assistant users and community",
  },
  de: {
    title: "Benutzer | Vex",
    description: "Entdecken Sie Vex KI-Assistenten-Benutzer und Community",
  },
  fr: {
    title: "Utilisateurs | Vex",
    description:
      "Explorez les utilisateurs et la communauté de l'assistant IA Vex",
  },
  ja: {
    title: "ユーザー | Vex",
    description: "Vex AIアシスタントのユーザーとコミュニティを探索",
  },
  ko: {
    title: "사용자 | Vex",
    description: "Vex AI 어시스턴트 사용자 및 커뮤니티 탐색",
  },
  pt: {
    title: "Usuários | Vex",
    description: "Explore usuários e comunidade do Assistente de IA Vex",
  },
  es: {
    title: "Usuarios | Vex",
    description: "Explore usuarios y comunidad del Asistente de IA Vex",
  },
  zh: {
    title: "用户 | Vex",
    description: "探索Vex AI助手用户和社区",
  },
  nl: {
    title: "Gebruikers | Vex",
    description: "Verken Vex AI-assistent gebruikers en community",
  },
  tr: {
    title: "Kullanıcılar | Vex",
    description: "Vex AI Asistanı kullanıcılarını ve topluluğunu keşfedin",
  },
}

/**
 * Generate metadata for About page
 */
export function generateAboutMetadata(
  locale: locale,
  siteConfig: ReturnType<typeof getSiteConfig>,
): MetadataResult {
  const t = aboutTranslations[locale] || aboutTranslations.en
  return {
    title: t.title,
    description: t.description,
    openGraph: {
      title: t.title,
      description: t.description,
      url: `${siteConfig.url}/about`,
      siteName: siteConfig.name || "Chrry",
    },
    twitter: {
      card: "summary",
      title: t.title,
      description: t.description,
    },
    alternates: {
      canonical: `${siteConfig.url}/about`,
    },
  }
}

/**
 * Generate metadata for Why page
 */
export function generateWhyMetadata(
  locale: locale,
  siteConfig: ReturnType<typeof getSiteConfig>,
): MetadataResult {
  const t = whyTranslations[locale] || whyTranslations.en
  return {
    title: t.title,
    description: t.description,
    openGraph: {
      title: t.title,
      description: t.description,
      url: `${siteConfig.url}/why`,
      siteName: siteConfig.name || "Chrry",
    },
    twitter: {
      card: "summary",
      title: t.title,
      description: t.description,
    },
    alternates: {
      canonical: `${siteConfig.url}/why`,
    },
  }
}

/**
 * Generate metadata for Privacy page
 */
export function generatePrivacyMetadata(
  locale: locale,
  siteConfig: ReturnType<typeof getSiteConfig>,
): MetadataResult {
  const t = privacyTranslations[locale] || privacyTranslations.en
  return {
    title: t.title,
    description: t.description,
    openGraph: {
      title: t.title,
      description: t.description,
      url: `${siteConfig.url}/privacy`,
      siteName: siteConfig.name || "Chrry",
    },
    twitter: {
      card: "summary",
      title: t.title,
      description: t.description,
    },
    alternates: {
      canonical: `${siteConfig.url}/privacy`,
    },
  }
}

/**
 * Generate metadata for Terms page
 */
export function generateTermsMetadata(
  locale: locale,
  siteConfig: ReturnType<typeof getSiteConfig>,
): MetadataResult {
  const t = termsTranslations[locale] || termsTranslations.en
  return {
    title: t.title,
    description: t.description,
    openGraph: {
      title: t.title,
      description: t.description,
      url: `${siteConfig.url}/terms`,
      siteName: siteConfig.name || "Chrry",
    },
    twitter: {
      card: "summary",
      title: t.title,
      description: t.description,
    },
    alternates: {
      canonical: `${siteConfig.url}/terms`,
    },
  }
}

/**
 * Generate metadata for Calendar page
 */
export function generateCalendarMetadata(
  locale: locale,
  siteConfig: ReturnType<typeof getSiteConfig>,
): MetadataResult {
  const t = calendarTranslations[locale] || calendarTranslations.en
  return {
    title: t.title,
    description: t.description,
    openGraph: {
      title: t.title,
      description: t.description,
      url: `${siteConfig.url}/calendar`,
      siteName: siteConfig.name || "Chrry",
    },
    twitter: {
      card: "summary",
      title: t.title,
      description: t.description,
    },
    alternates: {
      canonical: `${siteConfig.url}/calendar`,
    },
  }
}

/**
 * Generate metadata for Affiliate page
 */
export function generateAffiliateMetadata(
  locale: locale,
  siteConfig: ReturnType<typeof getSiteConfig>,
): MetadataResult {
  const t = affiliateTranslations[locale] || affiliateTranslations.en
  return {
    title: t.title,
    description: t.description,
    openGraph: {
      title: t.title,
      description: t.description,
      url: `${siteConfig.url}/affiliate`,
      siteName: siteConfig.name || "Chrry",
    },
    twitter: {
      card: "summary",
      title: t.title,
      description: t.description,
    },
    alternates: {
      canonical: `${siteConfig.url}/affiliate`,
    },
  }
}

/**
 * Generate metadata for Users page
 */
export function generateUsersMetadata(
  locale: locale,
  siteConfig: ReturnType<typeof getSiteConfig>,
): MetadataResult {
  const t = usersTranslations[locale] || usersTranslations.en
  return {
    title: t.title,
    description: t.description,
    openGraph: {
      title: t.title,
      description: t.description,
      url: `${siteConfig.url}/u`,
      siteName: siteConfig.name || "Chrry",
    },
    twitter: {
      card: "summary",
      title: t.title,
      description: t.description,
    },
    alternates: {
      canonical: `${siteConfig.url}/u`,
    },
  }
}

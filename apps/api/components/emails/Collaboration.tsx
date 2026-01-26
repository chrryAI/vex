import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import { thread, user, guest } from "@repo/db"
import { locale } from "@chrryai/chrry/locales"
import * as React from "react"
import { SiteConfig, getSiteConfig } from "@chrryai/chrry/utils/siteConfig"

type CollaborationEmailProps = {
  origin?: string
  thread: thread
  user?: user
  // guest?: guest
  language: locale
  type?: "accepted" | "invited"
  siteConfig?: SiteConfig
}

const translations = {
  es: {
    preview: {
      accepted: (app: string) =>
        `Has sido agregado a una colaboración en ${app}`,
      invited: (app: string) =>
        `Has sido invitado a una colaboración en ${app}`,
    },
    heading: {
      accepted: (title: string) => `Ahora estás colaborando en "${title}"`,
      invited: (title: string) => `Has sido invitado a colaborar en "${title}"`,
    },
    body: {
      accepted: (name: string) =>
        `${name} ha aceptado tu solicitud de colaboración. Ahora puedes acceder y contribuir a esta conversación.`,
      invited: (name: string) =>
        `${name} te ha invitado a colaborar en esta conversación. Haz clic en el enlace de abajo para unirte.`,
    },
    viewThread: "Ver Conversación",
  },
  fr: {
    preview: {
      accepted: (app: string) =>
        `Vous avez été ajouté à une collaboration sur ${app}`,
      invited: (app: string) =>
        `Vous avez été invité à une collaboration sur ${app}`,
    },
    heading: {
      accepted: (title: string) =>
        `Vous êtes maintenant en collaboration sur "${title}"`,
      invited: (title: string) =>
        `Vous avez été invité à collaborer sur "${title}"`,
    },
    body: {
      accepted: (name: string) =>
        `${name} a accepté votre demande de collaboration. Vous pouvez maintenant accéder et contribuer à cette conversation.`,
      invited: (name: string) =>
        `${name} vous a invité à collaborer sur cette conversation. Cliquez sur le lien ci-dessous pour rejoindre.`,
    },
    viewThread: "Voir la conversation",
  },
  pt: {
    preview: {
      accepted: (app: string) =>
        `Você foi adicionado a uma colaboração no ${app}`,
      invited: (app: string) =>
        `Você foi convidado para uma colaboração no ${app}`,
    },
    heading: {
      accepted: (title: string) => `Você está agora colaborando em "${title}"`,
      invited: (title: string) =>
        `Você foi convidado a colaborar em "${title}"`,
    },
    body: {
      accepted: (name: string) =>
        `${name} aceitou sua solicitação de colaboração. Agora você pode acessar e contribuir para esta conversa.`,
      invited: (name: string) =>
        `${name} convidou você para colaborar nesta conversa. Clique no link abaixo para participar.`,
    },
    viewThread: "Ver Conversa",
  },
  zh: {
    preview: {
      accepted: (app: string) => `您已加入一个协作在 ${app}`,
      invited: (app: string) => `您被邀请加入 ${app} 协作`,
    },
    heading: {
      accepted: (title: string) => `您现在正在协作 "${title}"`,
      invited: (title: string) => `您被邀请协作 "${title}"`,
    },
    body: {
      accepted: (name: string) =>
        `${name} 已接受您的协作请求。现在您可以访问并贡献到此对话。`,
      invited: (name: string) =>
        `${name} 邀请您协作此对话。点击下面的链接加入。`,
    },
    viewThread: "查看对话",
  },
  en: {
    preview: {
      accepted: (app: string) =>
        `You've been added to a collaboration on ${app}`,
      invited: (app: string) =>
        `You've been invited to a collaboration on ${app}`,
    },
    heading: {
      accepted: (title: string) => `You're now collaborating on "${title}"`,
      invited: (title: string) =>
        `You've been invited to collaborate on "${title}"`,
    },
    body: {
      accepted: (name: string) =>
        `${name} has accepted your collaboration request. You can now access and contribute to this thread.`,
      invited: (name: string) =>
        `${name} has invited you to collaborate on this thread. Click the link below to join.`,
    },
    viewThread: "View Thread",
  },
  tr: {
    preview: {
      accepted: (app: string) => `${app}'te bir işbirliğine eklendiniz`,
      invited: (app: string) => `${app}'te bir işbirliğine davet edildiniz`,
    },
    heading: {
      accepted: (title: string) =>
        `Artık "${title}" üzerinde işbirliği yapıyorsunuz`,
      invited: (title: string) =>
        `"${title}" üzerinde işbirliği yapmaya davet edildiniz`,
    },
    body: {
      accepted: (name: string) =>
        `${name} işbirliği isteğinizi kabul etti. Artık bu konuya erişebilir ve katkıda bulunabilirsiniz.`,
      invited: (name: string) =>
        `${name} sizi bu konuda işbirliği yapmaya davet etti. Katılmak için aşağıdaki bağlantıya tıklayın.`,
    },
    viewThread: "Konuyu Görüntüle",
  },
  de: {
    preview: {
      accepted: (app: string) =>
        `Sie wurden zu einer Zusammenarbeit auf ${app} hinzugefügt`,
      invited: (app: string) =>
        `Sie wurden zu einer Zusammenarbeit auf ${app} eingeladen`,
    },
    heading: {
      accepted: (title: string) =>
        `Sie arbeiten jetzt an der Zusammenarbeit "${title}"`,
      invited: (title: string) =>
        `Sie wurden zur Zusammenarbeit an "${title}" eingeladen`,
    },
    body: {
      accepted: (name: string) =>
        `${name} hat Ihr Zusammenarbeitsanfrage akzeptiert. Sie können jetzt auf diese Konversation zugreifen und beitragen.`,
      invited: (name: string) =>
        `${name} hat Sie zur Zusammenarbeit an dieser Konversation eingeladen. Klicken Sie auf den Link unten, um beizutreten.`,
    },
    viewThread: "Konversation anzeigen",
  },
  ja: {
    preview: {
      accepted: (app: string) => `${app}でのコラボレーションに追加されました`,
      invited: (app: string) => `${app}でのコラボレーションに招待されました`,
    },
    heading: {
      accepted: (title: string) => `"${title}"でコラボレーションしています`,
      invited: (title: string) =>
        `"${title}"でのコラボレーションに招待されました`,
    },
    body: {
      accepted: (name: string) =>
        `${name}さんがコラボレーションリクエストを承認しました。このスレッドにアクセスして貢献できます。`,
      invited: (name: string) =>
        `${name}さんがこのスレッドでのコラボレーションに招待しました。参加するには下のリンクをクリックしてください。`,
    },
    viewThread: "スレッドを表示",
  },
  ko: {
    preview: {
      accepted: (app: string) => `${app}에서의 협업에 초대되었습니다`,
      invited: (app: string) => `${app}에서 협업에 초대되었습니다`,
    },
    heading: {
      accepted: (title: string) => `지금 "${title}"에서 협업 중입니다`,
      invited: (title: string) => `"${title}"에서 협업하도록 초대되었습니다`,
    },
    body: {
      accepted: (name: string) =>
        `${name}님이 협업 요청을 승인했습니다. 이제 이 스레드에 접근하고 기여할 수 있습니다.`,
      invited: (name: string) =>
        `${name}님이 이 스레드에서 협업하도록 초대했습니다. 참여하려면 아래 링크를 클릭하세요.`,
    },
    viewThread: "스레드 보기",
  },
  nl: {
    preview: {
      accepted: (app: string) =>
        `U bent toegevoegd aan een samenwerking op ${app}`,
      invited: (app: string) =>
        `U bent uitgenodigd voor een samenwerking op ${app}`,
    },
    heading: {
      accepted: (title: string) => `U werkt nu samen aan "${title}"`,
      invited: (title: string) =>
        `U bent uitgenodigd om samen te werken aan "${title}"`,
    },
    body: {
      accepted: (name: string) =>
        `${name} heeft uw samenwerkingsverzoek geaccepteerd. U kunt nu toegang hebben tot en bijdragen aan deze conversatie.`,
      invited: (name: string) =>
        `${name} heeft u uitgenodigd om samen te werken aan deze conversatie. Klik op de onderstaande link om deel te nemen.`,
    },
    viewThread: "Bekijk conversatie",
  },
}

export default function CollaborationEmail({
  origin,
  user,
  thread,
  type = "accepted",
  language = "en",
  siteConfig = getSiteConfig(),
}: CollaborationEmailProps) {
  const t = translations[language] || translations.en
  const resolvedOrigin = origin || `https://${siteConfig.domain}`
  const iconName = siteConfig.name.toLowerCase() === "vex" ? "icon" : "chrry"

  return (
    <Html lang={language}>
      <Head />
      <Preview>{t.preview[type](siteConfig.name)}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src={`https://chrry.ai/icons/${iconName}-128.png`}
            width="64"
            height="64"
            alt={siteConfig.name}
          />
          <Heading style={heading}>{t.heading[type](thread.title)}</Heading>
          <Section style={body}>
            <Text style={paragraph}>
              {t.body[type](user?.name || user?.email || "A friend")}
            </Text>
            <Text style={paragraph}>
              <a href={`${resolvedOrigin}/threads/${thread.id}`} style={link}>
                {t.viewThread} →
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles remain the same
const main = {
  backgroundColor: "#ffffff",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
}

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #eee",
  borderRadius: "5px",
  margin: "0 auto",
  padding: "20px",
  width: "640px",
}

const heading = {
  color: "#333",
  fontSize: "24px",
  margin: "16px 0",
  textAlign: "center" as const,
}

const body = {
  padding: "16px",
}

const paragraph = {
  color: "#444",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "16px 0",
}

const link = {
  color: "#2754C5",
  fontSize: "16px",
  textDecoration: "underline",
}

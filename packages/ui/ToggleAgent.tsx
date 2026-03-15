import AppLink from "./AppLink"
import { useAppContext } from "./context/AppContext"
import {
  useApp,
  useAuth,
  useChat,
  useNavigationContext,
} from "./context/providers"
import { useStyles } from "./context/StylesContext"
import Img from "./Image"
import Loading from "./Loading"
import { Button } from "./platform"
import type { appWithStore } from "./types"
import { ADDITIONAL_CREDITS } from "./utils"
import isOwner from "./utils/isOwner"
export default function ToggleAgent({
  style,
  gotToText = "Go to Your Agent",
  createAgentText = "Create Your Agent",
  trainText = "Train {{name}}",
  tryText = "Try {{name}}",
  isPear = false,
  app,
  isTribe = false,
  small = true,
  className,
}: {
  style?: React.CSSProperties
  gotToText?: string
  createAgentText?: string
  app?: appWithStore
  trainText?: string
  tryText?: string
  isPear?: boolean
  isTribe?: boolean
  small?: boolean
  className?: string
} = {}) {
  const { accountApp, user, guest } = useAuth()
  const { t } = useAppContext()
  const { utilities } = useStyles()
  const { setAppStatus } = useApp()

  const { addParams } = useNavigationContext()

  const { creditsLeft } = useChat()

  const owner = isOwner(app, {
    userId: user?.id,
    guestId: guest?.id,
  })

  const TRAIN = owner ? trainText : tryText

  if (accountApp)
    return (
      <AppLink
        className={className || "inverted"}
        isTribe={isTribe}
        app={accountApp}
        loading={<Loading size={small ? 18 : 22} />}
        icon={<Img app={accountApp} size={small ? 18 : 22} />}
        style={{
          ...utilities.button.style,
          ...utilities.inverted.style,
          ...(small ? utilities.small.style : undefined),
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          display: "inline-flex",
          ...style,
        }}
      >
        {t(gotToText)}
      </AppLink>
    )

  if (app)
    return (
      <AppLink
        className={className || "inverted"}
        isTribe={false}
        isPear={isPear}
        app={app}
        icon={<Img app={app} size={small ? 18 : 22} />}
        loading={<Loading size={small ? 18 : 22} />}
        style={{
          ...utilities.button.style,
          ...utilities.inverted.style,
          ...(small ? utilities.small.style : undefined),
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          display: "inline-flex",
          ...style,
        }}
      >
        {t(TRAIN, {
          name: app?.name,
        })}
      </AppLink>
    )
  return (
    <Button
      onClick={() => {
        if (!user) {
          // Guest with insufficient credits OR no guest session yet → show credits modal
          if (!guest || (creditsLeft ?? 0) < ADDITIONAL_CREDITS) {
            addParams({ subscribe: "true", plan: "credits" })
            return
          }
        }
        setAppStatus({
          part: "settings",
          step: "add",
        })
      }}
      className={className || "inverted"}
      style={{
        ...utilities.inverted.style,
        ...(small ? utilities.small.style : undefined),
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        display: "inline-flex",
        ...style,
      }}
    >
      <Img size={small ? 18 : 22} icon="spaceInvader" />
      {t(createAgentText)}
    </Button>
  )
}

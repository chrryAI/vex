import { OpenRouter } from "@lobehub/icons"
import { useEffect, useState } from "react"
import { Trans } from "react-i18next"
import { SiMacos } from "react-icons/si"
import AppLink from "./AppLink"
import A from "./a/A"
import { useAppContext } from "./context/AppContext"
import { useNavigationContext } from "./context/providers"
import { useAuth } from "./context/providers/AuthProvider"
import { useStyles } from "./context/StylesContext"
import Img from "./Image"
import { ArrowRight, Info } from "./icons"
import LanguageSwitcher from "./LanguageSwitcher"
import Loading from "./Loading"
import { updateGuest, updateUser } from "./lib"
import { Button, Div, Form, H1, Input, Label, P, Span, toast } from "./platform"
import SignIn from "./SignIn"

export default function Watermelon() {
  const {
    setSignInPart,
    token,
    siteConfig,
    downloadUrl,
    chrry,
    user,
    guest,
    setGuest,
    setUser,
    actions,
  } = useAuth()

  const { t } = useAppContext()

  const [isBYOK, setIsBYOK] = useState(true)

  const openRouterApiKeyInitialValue =
    user?.apiKeys?.openrouter || guest?.apiKeys?.openrouter || ""

  const [openRouterApiKey, setOpenRouterApiKey] = useState(
    openRouterApiKeyInitialValue,
  )

  useEffect(() => {
    setOpenRouterApiKey(openRouterApiKeyInitialValue)
  }, [openRouterApiKeyInitialValue])

  const [isSavingOpenRouterApiKey, setIsSavingOpenRouterApiKey] =
    useState(false)

  const { utilities } = useStyles()

  const { push } = useNavigationContext()
  return (
    <Div
      style={{
        width: "100dvw",
        height: "100dvh",
        display: "flex",
        color: "var(--shade-8)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <Div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 25,
          position: "absolute",
          top: 15,
          right: 15,
          fontSize: "0.9rem",
        }}
      >
        <SignIn showSignIn={false} />
        <LanguageSwitcher />
      </Div>

      {chrry && (
        <P
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            position: "absolute",
            top: 15,
            left: 15,
            fontSize: "0.9rem",
          }}
        >
          <AppLink
            app={chrry}
            icon={chrry.icon}
            loading={<Loading size={13} />}
            className="button inverted medium"
            style={{
              padding: "0.3rem 0.6rem",
              fontFamily: "var(--font-sans)",
            }}
          >
            {chrry.name}
          </AppLink>{" "}
        </P>
      )}
      <Div
        style={{
          display: "flex",

          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 9.5,
          marginTop: 100,
        }}
      >
        <H1
          style={{
            display: "flex",
            alignItems: "center",
            margin: 0,
            fontSize: "1.5rem",
            gap: 15,
            fontFamily: "var(--font-mono)",
          }}
        >
          <Img width={50} height={50} slug="watermelon" />
          Watermelon&#169;
        </H1>
        <Div
          style={{
            display: "flex",
            gap: 15,
            marginTop: 10,
          }}
        >
          <A
            href={
              siteConfig.storeSlug !== "sushiStore"
                ? "https://sushi.chrry.ai"
                : "/"
            }
          >
            <Img alt="🍣 Sushi" width={22} height={22} slug="sushi" />
          </A>
          <A
            href={
              siteConfig.storeSlug !== "sushiStore"
                ? "https://sushi.chrry.ai/coder"
                : "/coder"
            }
            openInNewTab={siteConfig.slug !== "chrry"}
          >
            <Img alt="🍋 Coder" width={22} height={22} slug="coder" />
          </A>
          <A
            href={
              siteConfig.storeSlug !== "sushiStore"
                ? "https://sushi.chrry.ai/architect"
                : "/architect"
            }
            openInNewTab={siteConfig.slug !== "chrry"}
          >
            <Img alt="🥋 Architect" width={22} height={22} slug="architect" />
          </A>
          <A
            href={
              siteConfig.storeSlug !== "sushiStore"
                ? "https://sushi.chrry.ai/jules"
                : "/jules"
            }
            openInNewTab={siteConfig.slug !== "chrry"}
          >
            <Img alt="🐙 Jules" width={22} height={22} slug="jules" />
          </A>
          <A
            href={
              siteConfig.storeSlug !== "sushiStore"
                ? "https://sushi.chrry.ai/debugger"
                : "/debugger"
            }
            openInNewTab={siteConfig.slug !== "chrry"}
          >
            <Img alt="🐛 Debugger" width={22} height={22} slug="debugger" />
          </A>
          <A href={"/tribe"} style={{ fontSize: "0.85rem" }}>
            +35 AI Apps
          </A>
        </Div>
        <P
          style={{
            fontSize: "0.95rem",
            color: "var(--shade-7)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 15,
          }}
        >
          🔪 {t("Choose your weapon")} 🏹
        </P>
        <Div style={{ display: "flex", gap: 5, marginTop: 15 }}>
          <Button
            className="inverted"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0.25rem 0.5rem",
            }}
          >
            <Img
              alt="🌋 Free"
              width={22}
              height={22}
              src="https://chrry.ai/images/apps/coder.png"
            />
            Free (BYOK)
          </Button>
          <Button
            className="inverted"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0.25rem 0.5rem",
            }}
          >
            <Img
              alt="🍒 Chrry"
              width={16}
              height={16}
              src="https://chrry.ai/images/apps/chrry.png"
            />
            Chrry
          </Button>
          <A
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0.25rem 0.5rem",
            }}
            className="button inverted"
            href="https://chrry.ai/?subscribe=true&plan=watermelon"
            target="_blank"
          >
            <Img
              alt="🍉 Agency"
              width={16}
              height={16}
              src="https://chrry.ai/images/apps/watermelon.png"
            />
            Agency
          </A>
          <A
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0.25rem 0.5rem",
            }}
            className="button inverted"
            href="https://chrry.ai/?subscribe=true&plan=watermelon"
            target="_blank"
          >
            <Img
              alt="🦋 Sovereign"
              width={16}
              height={16}
              src="https://chrry.ai/images/apps/tribe.png"
            />
            Sovereign
          </A>
        </Div>
        <Form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!openRouterApiKey) {
              toast.error("Please enter your OpenRouter API key")
              return
            }

            // Client-side regex validation
            const openRouterRegex = /^sk-or-v1-[a-zA-Z0-9]{64}$/
            if (!openRouterRegex.test(openRouterApiKey.trim())) {
              toast.error(
                "Invalid OpenRouter API key format (Expected sk-or-v1-...)",
              )
              return
            }

            try {
              setIsSavingOpenRouterApiKey(true)
              if (user) {
                await actions.updateUser({
                  openRouterApiKey,
                })

                setUser({ ...user, apiKeys: { openrouter: openRouterApiKey } })

                toast.success("OpenRouter API key saved successfully")
              }

              if (guest) {
                await actions.updateGuest({
                  openRouterApiKey,
                })

                toast.success("OpenRouter API key saved successfully")

                setGuest({
                  ...guest,
                  apiKeys: { openrouter: openRouterApiKey },
                })
              }
            } catch (error) {
              console.error(error)
              toast.error("Something went wrong")
            } finally {
              setIsSavingOpenRouterApiKey(false)
            }
          }}
          style={{
            ...utilities.row.style,
            gap: 15,
            marginTop: 15,
            flexWrap: "wrap",
          }}
        >
          {!openRouterApiKey ? (
            <A openInNewTab href="https://openrouter.ai/keys">
              <OpenRouter size={20} /> OpenRouter*
            </A>
          ) : null}
          <Input
            dataTestId="openrouter-api-key"
            type="text"
            placeholder="sk-..."
            value={openRouterApiKey}
            onChange={(e) => setOpenRouterApiKey(e.target.value)}
            style={{
              border: "1px solid var(--accent-6)",
            }}
          />
          {openRouterApiKey ? (
            <Button
              className="inverted"
              type="submit"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "0.25rem 0.5rem",
              }}
            >
              <OpenRouter size={20} />
              {isSavingOpenRouterApiKey
                ? "Saving..."
                : user?.apiKeys?.openrouter || guest?.apiKeys?.openrouter
                  ? "Update"
                  : "Save"}
            </Button>
          ) : null}
        </Form>
        <P style={{ fontSize: ".85rem", marginTop: 10 }}>
          <A
            style={{
              color: "var(--shade-6)",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            openInNewTab
            href="https://github.com/chrryAI/vex/blob/main/packages/db/encryption.ts"
          >
            🔑 AES-256 GCM (Galois/Counter Mode)*
            <ArrowRight size={14} color="var(--accent-5)" />
          </A>
        </P>
      </Div>
      <Div
        style={{
          marginTop: "auto",
          textAlign: "center",
          maxWidth: 500,
          gap: 10,
          display: "flex",
          flexDirection: "column",
          marginBottom: 20,
          fontSize: ".9rem",
        }}
      >
        {!user && (
          <>
            <A
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) {
                  return
                }

                e.preventDefault()
                setSignInPart("login")
              }}
              href="/?signIn=login"
            >
              <Img alt="🍋 Coder" width={22} height={22} slug="coder" />{" "}
              {t("Login")}
            </A>
            <P style={{ fontSize: "0.9rem", color: "var(--shade-7)" }}>
              <Trans
                i18nKey="watermelon_guest_info"
                defaults="You can use your own API key as a guest. Your data will <0>auto-migrate</0> when you <1>login</1>. Login is optional, but you can always sync your account."
                components={[
                  <Span key="migrate" />,
                  <A key="login" onClick={() => setSignInPart("login")} />,
                ]}
              />
            </P>
          </>
        )}
        <Div>
          <P
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              justifyContent: "flex-end",
              marginBottom: 5,
              fontSize: ".8rem",
              color: "var(--shade-6)",
            }}
          >
            <A
              href={
                siteConfig.storeSlug !== "sushiStore"
                  ? "https://sushi.chrry.ai/jules"
                  : "/jules"
              }
              openInNewTab={siteConfig.slug !== "chrry"}
            >
              <Img alt="🐙 Jules" width={18} height={18} slug="jules" />
            </A>
            {t("Sneak peek")}
            <Button
              className="inverted"
              style={{
                ...utilities.small.style,

                paddingTop: "0",
                paddingBottom: "0",
              }}
              onClick={() => {
                const a = document.createElement("a")
                a.href = downloadUrl
                a.download = ""
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
              }}
            >
              <SiMacos
                style={{
                  position: "relative",
                  bottom: 1,
                }}
                size={32}
              />
              {/* {t("Install")} */}
            </Button>
          </P>

          <P style={{ fontSize: "0.85rem", color: "var(--shade-7)" }}>
            💻{" "}
            <Trans
              i18nKey="watermelon_macos_info"
              defaults="Coming soon: A <0>macOS Desktop App</0> with local DB support (MIT Licensed) for fully private configuration."
              components={[
                <A
                  key="macos"
                  openInNewTab
                  href="https://github.com/chrryAI/vex"
                />,
              ]}
            />
          </P>
        </Div>
      </Div>
    </Div>
  )
}

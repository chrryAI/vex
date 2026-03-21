import { useEffect, useState } from "react"
import { Trans } from "react-i18next"
import { BiLogoPostgresql } from "react-icons/bi"
import {
  SiBun,
  SiBuymeacoffee,
  SiHetzner,
  SiHono,
  SiMacos,
  SiMinio,
  SiRedis,
  SiTauri,
  SiVite,
} from "react-icons/si"
import AppLink from "./AppLink"
import A from "./a/A"
import ColorScheme from "./ColorScheme"
import ConfirmButton from "./ConfirmButton"
import { useAppContext } from "./context/AppContext"
import { COLORS } from "./context/providers/AppProvider"
import { useAuth } from "./context/providers/AuthProvider"
import { useStyles } from "./context/StylesContext"
import { useTheme } from "./context/ThemeContext"
import Img from "./Image"
import {
  ArrowRight,
  Claude,
  Coins,
  DeepSeek,
  Flux,
  Gemini,
  Grok,
  OpenAI,
  OpenRouter,
  Perplexity,
  Replicate,
  WannathisIcon,
} from "./icons"
import LanguageSwitcher from "./LanguageSwitcher"
import Loading from "./Loading"
import LocalSetupScreen from "./LocalSetupScreen"
import {
  Button,
  Div,
  Form,
  H1,
  Input,
  P,
  Span,
  toast,
  usePlatform,
} from "./platform"
import SignIn from "./SignIn"
import Subscribe from "./Subscribe"
import ThemeSwitcher from "./ThemeSwitcher"
import { VERSION } from "./utils"
import { ANALYTICS_EVENTS } from "./utils/analyticsEvents"
import Weather from "./Weather"

// Tauri injects this global — safe to check at runtime

// Separate component so hooks aren't violated
function LocalSetupModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "fixed",
          top: 46,
          right: 16,
          zIndex: 1000,
          background: "#27272a",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          cursor: "pointer",
          fontSize: "0.8rem",
        }}
      >
        ✕ Close
      </button>
      <LocalSetupScreen onReady={onClose} />
    </div>
  )
}

export default function Watermelon() {
  const [showLocalSetup, setShowLocalSetup] = useState(false)

  const {
    setSignInPart,
    app,
    siteConfig,
    downloadUrl,
    user,
    guest,
    setGuest,
    setUser,
    actions,
    storeApps,
    plausible,
  } = useAuth()

  const jules = storeApps.find((app) => app.slug === "jules")
  const [isSavingReplicateApiKey, setIsSavingReplicateApiKey] = useState(false)

  const { t, captureException } = useAppContext()

  const openRouterApiKeyInitialValue =
    user?.apiKeys?.openrouter || guest?.apiKeys?.openrouter || ""

  const replicateApiKeyInternal =
    user?.apiKeys?.replicate || guest?.apiKeys?.replicate || ""

  const [replicateApiKey, setReplicateApiKey] = useState(
    replicateApiKeyInternal,
  )

  useEffect(() => {
    setReplicateApiKey(replicateApiKeyInternal)
  }, [replicateApiKeyInternal])

  const [openRouterApiKey, setOpenRouterApiKey] = useState(
    openRouterApiKeyInitialValue,
  )

  useEffect(() => {
    if (!user && !guest) return
    plausible({ name: ANALYTICS_EVENTS.WATERMELON })
  }, [user, guest])

  useEffect(() => {
    setOpenRouterApiKey(openRouterApiKeyInitialValue)
  }, [openRouterApiKeyInitialValue])

  const [isSavingOpenRouterApiKey, setIsSavingOpenRouterApiKey] =
    useState(false)

  const [isDeletingOpenRouterApiKey, setIsDeletingOpenRouterApiKey] =
    useState(false)

  const [isDeletingReplicateApiKey, setIsDeletingReplicateApiKey] =
    useState(false)

  // const [isDeletingFalApiKey, setIsDeletingFalApiKey] = useState(false)

  const { utilities } = useStyles()

  const { isTauri, viewPortWidth } = usePlatform()

  const { isMobileDevice, colorScheme } = useTheme()

  // const { push } = useNavigationContext()
  return (
    <>
      <Div
        style={{
          width: "100dvw",
          display: "flex",
          color: "var(--shade-8)",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          padding: "0 1rem",
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
          <Subscribe />
          <LanguageSwitcher />
        </Div>

        {app && (
          <P
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              position: "absolute",
              top: 15,
              left: 15,
              fontSize: "0.9rem",
              marginTop: isTauri ? 20 : 0,
            }}
          >
            <AppLink
              app={app}
              event={ANALYTICS_EVENTS.WM_APP_LINK_CLICK}
              icon={<Img app={app} alt={app.name} width={16} height={16} />}
              loading={<Loading size={13} />}
              className="button inverted medium"
              style={{
                padding: "0.3rem 0.6rem",
                fontFamily: "var(--font-sans)",
              }}
            >
              {app.name}
            </AppLink>{" "}
          </P>
        )}

        {isTauri && showLocalSetup ? (
          <LocalSetupModal onClose={() => setShowLocalSetup(false)} />
        ) : (
          <>
            <Div
              style={{
                display: "flex",

                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 9.5,
                marginTop: isMobileDevice ? 75 : 100,
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
                {t("Watermelon")}&#169;
              </H1>
              <Div
                style={{
                  display: "flex",
                  gap: 15,
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 15,
                  marginBottom: 5,
                }}
              >
                {storeApps.slice(0, 7).map((item, i) => {
                  return (
                    <Div key={`post-${item.id}`}>
                      <AppLink
                        event={ANALYTICS_EVENTS.WM_APP_LINK_CLICK}
                        app={item}
                        className="link"
                        style={{
                          ...utilities.link.style,
                        }}
                      >
                        <Img app={item} />
                      </AppLink>
                    </Div>
                  )
                })}
                <A
                  href={"/tribe"}
                  event={ANALYTICS_EVENTS.WM_TRIBE_LINK_CLICK}
                  style={{ fontSize: "0.85rem" }}
                >
                  {t("+{{count}} AI Apps", { count: storeApps.length })}
                </A>
              </Div>
              <P
                style={{
                  fontSize: "1rem",
                  color: "var(--shade-7)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 15,
                }}
              >
                🔪<Span>{t("Choose your weapon")}</Span>🏹
              </P>
              <Div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 15,
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Button
                  className="inverted"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "0.25rem 0.5rem",
                  }}
                >
                  <Img alt="🌋 Free" width={22} height={22} slug="coder" />
                  {t("Free")} (BYOK)
                </Button>
                {app && (
                  <AppLink
                    isTribe={false}
                    app={app}
                    className="button inverted"
                    icon={
                      <Img app={app} alt={app.name} width={22} height={22} />
                    }
                    loading={<Loading size={13} />}
                    style={{
                      ...utilities.button.style,
                      ...utilities.inverted.style,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "0.25rem 0.5rem",
                    }}
                  >
                    {t(app.name)}
                  </AppLink>
                )}
                <A
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "0.25rem 0.5rem",
                  }}
                  className="button transparent"
                  href="?subscribe=true&plan=watermelon"
                >
                  <Img
                    alt="🍉 Agency"
                    width={22}
                    height={22}
                    src="https://chrry.ai/images/apps/watermelon.png"
                  />
                  {t("Agency")}
                </A>
                <A
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "0.25rem 0.5rem",
                  }}
                  className="button transparent"
                  href="?subscribe=true&plan=watermelon&watermelonTier=plus"
                >
                  <Img alt="🦋 Sovereign" width={22} height={22} slug="tribe" />
                  {t("Sovereign")}
                </A>
              </Div>
              <Div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12.5,
                  marginTop: 17.5,
                  fontSize: "0.8rem",
                  color: COLORS.blue,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {isTauri ? (
                  <Button
                    type="button"
                    className="inverted"
                    onClick={() => setShowLocalSetup(true)}
                  >
                    <Img slug="whale" />
                    {t("Local Stack")}
                  </Button>
                ) : (
                  <Span
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <Img slug="whale" size={30} /> {t("Stack")}
                  </Span>
                )}
                {viewPortWidth >= 1400 && (
                  <A
                    onClick={() => {
                      plausible({
                        name: ANALYTICS_EVENTS.WANNATHIS,
                        props: {
                          app: app?.name,
                        },
                      })
                    }}
                    href="https://wannathis.one?via=iliyan"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <WannathisIcon />
                  </A>
                )}
                <A openInNewTab href="https://postgresql.org">
                  <BiLogoPostgresql title="PostgreSQL" size={20} />
                </A>
                <A openInNewTab href="https://www.falkordb.com">
                  <SiRedis color={COLORS.red} title="FalkorDB" size={20} />
                </A>
                <A openInNewTab href="https://bun.sh">
                  <SiBun color={COLORS.orange} title="Bun" size={20} />
                </A>
                <A openInNewTab href="https://hono.dev">
                  <SiHono color={COLORS.red} title="Hono" size={20} />
                </A>
                <A openInNewTab href="https://vitejs.dev">
                  <SiVite color={COLORS.green} title="Vite" size={20} />
                </A>
                <A openInNewTab href="https://tauri.app">
                  <SiTauri color={COLORS.orange} title="Tauri" size={20} />
                </A>
                <A openInNewTab href="https://hetzner.cloud/?ref=jBud3ivK4tnH">
                  <SiHetzner color={COLORS.red} title="Hetzner" size={20} />
                </A>
                <A openInNewTab href="https://min.io">
                  <SiMinio color={COLORS.red} title="MinIO" size={20} />
                </A>
                <A openInNewTab href="https://chatgpt.com">
                  <OpenAI color={"var(--foreground)"} size={20} />
                </A>
                <A openInNewTab href="https://chat.deepseek.com">
                  <DeepSeek color={COLORS.blue} size={20} />
                </A>
                <A openInNewTab href="https://claude.ai">
                  <Claude color={COLORS.orange} size={20} />
                </A>
                <A
                  openInNewTab
                  color={COLORS.blue}
                  href="https://perplexity.ai"
                >
                  <Perplexity size={20} />
                </A>

                <A openInNewTab href="https://grok.com">
                  <Grok color={"var(--foreground)"} size={20} />
                </A>
                <A openInNewTab href="http://gemini.google.com">
                  <Gemini size={20} />
                </A>
              </Div>
              <Div
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
              >
                <Form
                  onSubmit={async (e) => {
                    plausible({ name: ANALYTICS_EVENTS.WM_BYOK_SUBMIT })
                    e.preventDefault()
                    if (!openRouterApiKey) {
                      toast.error(t("Please enter your OpenRouter API key"))
                      return
                    }

                    // Client-side regex validation
                    const openRouterRegex = /^sk-or-v1-[a-zA-Z0-9]{64}$/
                    if (!openRouterRegex.test(openRouterApiKey.trim())) {
                      toast.error(
                        t(
                          "Invalid OpenRouter API key format (Expected sk-or-v1-...)",
                        ),
                      )
                      return
                    }

                    try {
                      setIsSavingOpenRouterApiKey(true)
                      if (user) {
                        await actions.updateUser({
                          openRouterApiKey,
                        })

                        setUser({
                          ...user,
                          apiKeys: {
                            ...user.apiKeys,
                            openrouter: openRouterApiKey,
                          },
                        })

                        toast.success(
                          t("OpenRouter API key saved successfully"),
                        )
                        plausible({
                          name: ANALYTICS_EVENTS.WM_BYOK_SUBMIT_SUCCESS,
                        })
                      }

                      if (guest) {
                        await actions.updateGuest({
                          openRouterApiKey,
                        })

                        toast.success(
                          t("OpenRouter API key saved successfully"),
                        )

                        setGuest({
                          ...guest,
                          apiKeys: {
                            ...guest.apiKeys,
                            openrouter: openRouterApiKey,
                          },
                        })
                        plausible({
                          name: ANALYTICS_EVENTS.WM_BYOK_SUBMIT_SUCCESS,
                        })
                      }
                    } catch (error) {
                      console.error(error)
                      toast.error(t("Something went wrong"))
                      captureException(error)
                      plausible({ name: ANALYTICS_EVENTS.WM_BYOK_SUBMIT_ERROR })
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
                  <A
                    openInNewTab
                    style={{ position: "relative" }}
                    href="https://openrouter.ai/keys"
                  >
                    <OpenRouter size={20} />{" "}
                    {viewPortWidth >= 400 ? "OpenRouter*" : undefined}
                    {viewPortWidth >= 400 ? (
                      <Span
                        style={{
                          fontSize: ".65rem",
                          position: "absolute",
                          bottom: -15,
                          right: 3,
                          color: COLORS.red,
                        }}
                      >
                        {t("Required")}
                      </Span>
                    ) : null}
                  </A>
                  {openRouterApiKeyInitialValue ? (
                    <ConfirmButton
                      disabled={isDeletingOpenRouterApiKey}
                      processing={isDeletingOpenRouterApiKey}
                      onConfirm={async () => {
                        try {
                          setIsDeletingOpenRouterApiKey(true)
                          if (user) {
                            await actions.updateUser({
                              deletedApiKeys: ["openrouter"],
                            })

                            setUser({
                              ...user,
                              apiKeys: {
                                ...user.apiKeys,
                                openrouter: undefined,
                              },
                            })

                            toast.success(
                              t("OpenRouter API key deleted successfully"),
                            )
                          }

                          if (guest) {
                            await actions.updateGuest({
                              deletedApiKeys: ["openrouter"],
                            })

                            toast.success(
                              t("OpenRouter API key deleted successfully"),
                            )

                            setGuest({
                              ...guest,
                              apiKeys: {
                                ...guest.apiKeys,
                                openrouter: undefined,
                              },
                            })
                          }
                        } catch (error) {
                          console.error(error)
                          toast.error(t("Something went wrong"))
                        } finally {
                          setIsDeletingOpenRouterApiKey(false)
                        }
                      }}
                      className="link"
                    />
                  ) : null}
                  <Input
                    dataTestId="openrouter-api-key"
                    type="text"
                    placeholder="sk-..."
                    value={openRouterApiKey}
                    onChange={(e) => setOpenRouterApiKey(e.target.value)}
                    style={{
                      border: "1px solid var(--accent-6)",
                      borderColor: colorScheme,
                      flex: 1,
                      width: viewPortWidth < 400 ? "fit-content" : undefined,
                    }}
                  />
                  <Button
                    className="inverted"
                    type="submit"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "0.25rem 0.5rem",
                      marginLeft: "auto",
                    }}
                  >
                    <OpenRouter size={20} />
                    {isSavingOpenRouterApiKey
                      ? "Saving..."
                      : user?.apiKeys?.openrouter || guest?.apiKeys?.openrouter
                        ? "Update"
                        : "Save"}
                  </Button>
                </Form>
                <Form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!replicateApiKey) {
                      toast.error(t("Please enter your Replicate API key"))
                      return
                    }

                    // OpenRouter key is required before Replicate
                    if (
                      !user?.apiKeys?.openrouter &&
                      !guest?.apiKeys?.openrouter
                    ) {
                      toast.error(
                        t("Please save your OpenRouter API key first"),
                      )
                      return
                    }

                    // Client-side regex validation (Replicate keys start with r8_)
                    const replicateRegex = /^r8_[a-zA-Z0-9]{37,42}$/
                    if (!replicateRegex.test(replicateApiKey.trim())) {
                      toast.error(
                        t("Invalid Replicate API key format (Expected r8_...)"),
                      )
                      return
                    }

                    try {
                      setIsSavingReplicateApiKey(true)
                      if (user) {
                        await actions.updateUser({
                          replicateApiKey,
                        })

                        setUser({
                          ...user,
                          apiKeys: {
                            ...user.apiKeys,
                            replicate: replicateApiKey,
                          },
                        })

                        toast.success(t("Replicate API key saved successfully"))
                      }

                      if (guest) {
                        await actions.updateGuest({
                          replicateApiKey,
                        })

                        toast.success(t("Replicate API key saved successfully"))

                        setGuest({
                          ...guest,
                          apiKeys: {
                            ...guest.apiKeys,
                            replicate: replicateApiKey,
                          },
                        })
                      }
                    } catch (error) {
                      console.error(error)
                      toast.error(t("Something went wrong"))
                    } finally {
                      setIsSavingReplicateApiKey(false)
                    }
                  }}
                  style={{
                    ...utilities.row.style,
                    gap: 15,
                    flexWrap: "wrap",
                  }}
                >
                  <A
                    href="https://replicate.com/account/api-tokens"
                    openInNewTab
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      position: "relative",
                    }}
                  >
                    <Replicate size={20} />{" "}
                    {viewPortWidth >= 400 ? "Replicate*" : undefined}
                    {viewPortWidth >= 400 ? (
                      <Span
                        style={{
                          fontSize: ".65rem",
                          position: "absolute",
                          bottom: -15,
                          right: 3,
                          color: COLORS.orange,
                        }}
                      >
                        {t("Optional")}
                      </Span>
                    ) : null}
                  </A>
                  {replicateApiKeyInternal ? (
                    <ConfirmButton
                      disabled={isDeletingReplicateApiKey}
                      processing={isDeletingReplicateApiKey}
                      onConfirm={async () => {
                        try {
                          setIsDeletingReplicateApiKey(true)
                          if (user) {
                            await actions.updateUser({
                              deletedApiKeys: ["replicate"],
                            })

                            setUser({
                              ...user,
                              apiKeys: {
                                ...user.apiKeys,
                                replicate: undefined,
                              },
                            })

                            toast.success(
                              "Replicate API key deleted successfully",
                            )
                          }

                          if (guest) {
                            await actions.updateGuest({
                              deletedApiKeys: ["replicate"],
                            })

                            toast.success(
                              "Replicate API key deleted successfully",
                            )

                            setGuest({
                              ...guest,
                              apiKeys: {
                                ...guest.apiKeys,
                                replicate: undefined,
                              },
                            })
                          }

                          setReplicateApiKey("")
                        } catch (error) {
                          console.error(error)
                          toast.error("Something went wrong")
                        } finally {
                          setIsDeletingReplicateApiKey(false)
                        }
                      }}
                      className="link"
                    />
                  ) : null}
                  <Input
                    dataTestId="replicate-api-key"
                    type="text"
                    placeholder="r8_..."
                    value={replicateApiKey}
                    onChange={(e) => setReplicateApiKey(e.target.value)}
                    style={{
                      borderColor: colorScheme,
                      flex: 1,
                      width: viewPortWidth < 400 ? "fit-content" : undefined,
                    }}
                  />
                  <Button
                    className="inverted"
                    type="submit"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "0.25rem 0.5rem",
                      marginLeft: "auto",
                    }}
                  >
                    <Flux size={20} />
                    {isSavingReplicateApiKey
                      ? "Saving..."
                      : user?.apiKeys?.replicate || guest?.apiKeys?.replicate
                        ? "Update"
                        : "Save"}
                  </Button>
                </Form>
              </Div>

              <P
                style={{ fontSize: ".85rem", marginTop: 25, marginBottom: 25 }}
              >
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
                  🔑 {t("AES-256 GCM (Galois/Counter Mode)")}
                  <ArrowRight size={14} color="var(--accent-5)" />
                </A>
              </P>
            </Div>
            <Div
              style={{
                marginTop: "auto",
                display: "flex",
                gap: ".5rem",
                flexWrap: "wrap",
                flexDirection: "row",
                position: "relative",
                bottom: ".5rem",
                marginBottom: 20,
              }}
            >
              <Div
                style={{
                  display: "flex",
                  gap: ".7rem",
                  flexWrap: "wrap",
                  fontSize: ".85rem",
                }}
              >
                <A href="/about">
                  {app?.store?.app?.icon || "🍒"} /{t("about")}
                </A>
                <A href="/privacy">🤫 /{t("privacy")}</A>
                <A
                  event={ANALYTICS_EVENTS.BUY_ME_A_COFFEE_CLICK}
                  href="https://buymeacoffee.com/iliyan"
                  openInNewTab
                  title="Buy me a coffee"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: ".9rem",
                    color: COLORS.orange,
                  }}
                >
                  <SiBuymeacoffee color={COLORS.orange} size={16} />
                  {t("BAM")} 💥
                </A>
              </Div>
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
                        <A
                          key="login"
                          onClick={() => setSignInPart("login")}
                        />,
                      ]}
                    />
                  </P>
                </>
              )}
              {!isTauri && (
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
                          event={ANALYTICS_EVENTS.GH_REPO_CLICK}
                          key="macos"
                          openInNewTab
                          href="https://github.com/chrryAI/vex"
                        />,
                      ]}
                    />
                  </P>
                </Div>
              )}
            </Div>
            <Div
              style={{
                marginTop: 35,
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                display: "flex",
                marginBottom: 20,
              }}
            >
              <ThemeSwitcher style={{ marginTop: 5 }} />
              <ColorScheme />
            </Div>
            <P
              style={{
                fontSize: "0.8rem",
                color: "var(--shade-7)",
                display: "flex",
                gap: 5,
                marginBottom: isMobileDevice ? 25 : 25,
              }}
            >
              <Img icon={"hamster"} size={20} />{" "}
              <Span>v{app?.version || VERSION}</Span>
            </P>
            <P
              style={{
                marginBottom: isMobileDevice ? 25 : 15,
                display: "flex",
                gap: 7.5,
                alignItems: "center",
              }}
            >
              <Weather showLocation />
              <A href="/about">
                <Img icon="hippo" size={25} />
              </A>
            </P>
          </>
        )}
      </Div>
    </>
  )
}

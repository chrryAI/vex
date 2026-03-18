"use client"

import clsx from "clsx"
import { lazy, Suspense, useEffect } from "react"
import { useAppContext } from "./context/AppContext"
import Grapes from "./Grapes"
import Img from "./Image"
import { CircleEllipsis } from "./icons"
import LanguageSwitcher from "./LanguageSwitcher"
import Menu from "./Menu"

// Lazy load heavy components to reduce initial bundle
const Subscribe = lazy(() => import("./Subscribe"))
const SignIn = lazy(() => import("./SignIn"))
const CharacterProfiles = lazy(() => import("./CharacterProfiles"))

import A from "./a/A"
import AddToHomeScreen from "./addToHomeScreen"
import {
  useApp,
  useAuth,
  useChat,
  useNavigationContext,
} from "./context/providers"
import { useStyles } from "./context/StylesContext"
import { useTimerContext } from "./context/TimerContext"
import { useHasHydrated } from "./hooks"
import {
  Button,
  Div,
  H1,
  Main,
  Span,
  usePlatform,
  useTheme,
  VexToast,
} from "./platform"
import Version from "./Version"

function Grape({
  isDrawerOpen,
}: {
  time: number
  isCountingDown?: boolean
  isDrawerOpen?: boolean
}) {
  const { viewPortWidth } = usePlatform()

  const hasHydrated = useHasHydrated()
  const { utilities } = useStyles()

  if (!isDrawerOpen || viewPortWidth < 700 || !hasHydrated) {
    return null
  }

  return (
    <Grapes
      slug={"raspberry"}
      dataTestId="grapes-button"
      style={{
        ...utilities.xSmall.style,
        marginTop: !isDrawerOpen ? 1 : -7.5,
        marginLeft: isDrawerOpen ? 0 : -5,
        position: "relative",

        left: 250,
      }}
    />
  )
}
export default function Skeleton({
  className,
  children,
  showThreads = true,
}: {
  className?: string
  children?: React.ReactNode
  showThreads?: boolean
}): React.ReactElement {
  const { isCapacitor, os } = usePlatform()
  const { time, isCountingDown } = useTimerContext()
  const { t } = useAppContext()

  const hasHydrated = useHasHydrated()

  // Split contexts for better organization

  // Auth context

  // Chat context
  const { isEmpty } = useChat()

  // Navigation context
  const { pathname, setIsNewChat, hasNotification, push } =
    useNavigationContext()

  const { isDrawerOpen, setIsDrawerOpen, isSmallDevice, isMobileDevice } =
    useTheme()

  // Platform context
  const { isStandalone, isTauri } = usePlatform()

  // Data context

  const {
    threadIdRef,
    isIDE,
    getAppSlug,
    getTribeUrl,
    FRONTEND_URL,
    rtl,
    ...auth
  } = useAuth()

  const showTribeProfile = auth.showTribeProfile && !auth.postId && isEmpty

  const threadId = threadIdRef.current

  // App context
  const { app, isAgentModalOpen } = useApp()

  // Theme context
  const { addHapticFeedback } = useTheme()

  const toggleMenu = () => {
    addHapticFeedback()
    setIsDrawerOpen(!isDrawerOpen)
  }

  useEffect(() => {
    // Preload toast icons
    const preloadImages = [
      `${FRONTEND_URL}/frog.png`,
      `${FRONTEND_URL}/hamster.png`,
    ]

    if (typeof Image !== "undefined") {
      preloadImages.forEach((src) => {
        const img = new Image()
        img.src = src
      })
    }

    // Enable body scroll on Capacitor
    if (isCapacitor && os === "ios") {
      document.body.style.overflow = "auto"
      ;(document.body.style as any).WebkitOverflowScrolling = "touch"
    }
  }, [FRONTEND_URL, isCapacitor, os])

  // Call ALL hooks sssbefore any conditional returns
  const { skeletonStyles, utilities } = useStyles()

  return (
    <Div
      id="skeleton"
      className={clsx(className)}
      style={{
        ...skeletonStyles.page.style,
        paddingLeft: !isSmallDevice && isDrawerOpen && !rtl ? 255 : undefined,
        paddingRight: !isSmallDevice && isDrawerOpen && rtl ? 255 : undefined,
        background: "transparent",
        // paddingTop: isCapacitor && os === "ios" ? 40 : undefined,
      }}
    >
      <Div
        style={{
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          display: "flex",
        }}
      >
        <Version />
        <Menu showThreads={showThreads} />
        <Main
          style={{
            ...{
              padding: 10,
              paddingTop: 50,
              display: "flex",
              flexDirection: "column",
              flex: 1,
              height: "100dvh",
            },
            ...{
              display: "flex",
            },
          }}
        >
          <Div
            className="blur"
            data-tauri-drag-region
            onDoubleClick={async () => {
              if (!isTauri) return
              try {
                const { getCurrentWindow } = await import(
                  "@tauri-apps/api/window"
                )
                const appWindow = getCurrentWindow()
                const isMaximized = await appWindow.isMaximized()
                if (isMaximized) {
                  await appWindow.unmaximize()
                } else {
                  await appWindow.maximize()
                }
              } catch (_e) {
                // Tauri API not available
              }
            }}
            style={{
              ...skeletonStyles.header.style,
              ...(hasHydrated &&
                isStandalone &&
                skeletonStyles.headerStandalone.style),
              ...(hasHydrated &&
              isCapacitor &&
              os === "ios" &&
              (!threadId || isEmpty)
                ? { paddingTop: 55 }
                : {}),
              ...(hasHydrated &&
              isCapacitor &&
              os === "ios" &&
              (threadId || !isEmpty)
                ? {
                    position: "fixed",
                    top: 0,
                    paddingTop: 50,
                    backgroundColor: "var(--background)",
                  }
                : {}),
              ...{
                backgroundColor: "none",
              },
            }}
          >
            {isIDE ? (
              <></>
            ) : (
              <>
                <Div style={{ ...skeletonStyles.hamburgerMenu.style }}>
                  <Div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      paddingTop:
                        hasHydrated && !isDrawerOpen && isTauri && !rtl
                          ? "1.4rem"
                          : "0",
                    }}
                  >
                    {!isDrawerOpen && (
                      <Button
                        className="link"
                        style={{
                          ...skeletonStyles.hamburgerButton.style,
                          ...utilities.link,
                        }}
                        onClick={toggleMenu}
                      >
                        {hasNotification && (
                          <Span
                            style={{ ...skeletonStyles.notification.style }}
                          />
                        )}
                        <CircleEllipsis
                          strokeWidth={1.5}
                          color="var(--accent-1)"
                          size={24}
                        />
                      </Button>
                    )}
                    {!isDrawerOpen ? (
                      <Div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <A
                          className="link"
                          href={
                            showTribeProfile
                              ? getTribeUrl()
                              : app
                                ? getAppSlug(app)
                                : "/"
                          }
                          style={{
                            ...utilities.link.style,
                            ...skeletonStyles.hamburgerButton.style,
                            marginRight: 15,
                          }}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey) {
                              return
                            }
                            e.preventDefault()
                            if (showTribeProfile) {
                              setIsNewChat({
                                value: true,
                                to: getTribeUrl(),
                                tribe: true,
                              })
                              return
                            }

                            setIsNewChat({
                              value: true,
                            })
                          }}
                        >
                          <Img
                            key={app?.id || "vex"}
                            app={showTribeProfile ? undefined : app}
                            size={28}
                            slug={showTribeProfile ? "tribe" : undefined}
                            priority
                          />
                          <H1
                            key={`title-${app?.id || "vex"}`}
                            style={{ ...skeletonStyles.brand.style }}
                          >
                            {t(showTribeProfile ? "Tribe" : app?.name || "Vex")}
                          </H1>
                        </A>
                      </Div>
                    ) : null}

                    {isMobileDevice ? null : (
                      <Grape
                        isDrawerOpen={isDrawerOpen}
                        time={time}
                        isCountingDown={isCountingDown}
                      />
                    )}
                  </Div>
                </Div>
                <Div
                  style={{
                    ...skeletonStyles.right.style,
                    paddingTop: isTauri && rtl ? "1.3rem" : "0",
                  }}
                >
                  <Suspense fallback={null}>
                    <CharacterProfiles />
                  </Suspense>

                  {!isAgentModalOpen && (
                    <Suspense fallback={null}>
                      <Subscribe />
                    </Suspense>
                  )}

                  <Suspense fallback={null}>
                    <SignIn showSignIn={false} />
                  </Suspense>

                  <LanguageSwitcher />
                </Div>
              </>
            )}
          </Div>
          <Div
            style={{
              ...skeletonStyles.contentContainer.style,
              position: "relative",
              paddingTop: isTauri && rtl ? "1.2rem" : "0.2rem",
            }}
          >
            <>{children}</>
          </Div>
        </Main>
      </Div>
      {hasHydrated && (
        <>
          <AddToHomeScreen />
          <VexToast />
        </>
      )}
    </Div>
  )
}

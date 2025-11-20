"use client"

import React, { useEffect, useRef, useState } from "react"
// import styles from "./Menu.module.scss"
import clsx from "clsx"
import {
  ArrowLeft,
  AtSign,
  BellDot,
  HatGlasses,
  LoaderCircle,
  LockOpen,
  MessageCirclePlus,
  PanelRight,
  Search,
  Tornado,
  UserLock,
  UserRoundCog,
  UserRoundPlus,
  UsersRound,
  WannathisIcon,
} from "./icons"
import {
  BrowserInstance,
  checkIsExtension,
  FRONTEND_URL,
  VERSION,
} from "./utils"
import { hasThreadNotification } from "./utils/hasThreadNotification"
import Loading from "./Loading"
import { useAppContext } from "./context/AppContext"
import {
  useAuth,
  useNavigationContext,
  useApp,
  useChat,
} from "./context/providers"
import { Button, Div, H4, Span, usePlatform, useTheme } from "./platform"
import { animate, stagger } from "motion"
import { useHasHydrated } from "./hooks"
import Bookmark from "./Bookmark"
import CollaborationStatus from "./CollaborationStatus"
import ColorScheme from "./ColorScheme"
import { defaultLocale } from "./locales"
import Img from "./Image"
import EmptyStateTips from "./EmptyStateTips"
import ThemeSwitcher from "./ThemeSwitcher"
import { useStyles } from "./context/StylesContext"
import { useMenuStyles } from "./Menu.styles"
import A from "./A"

export default function Menu({
  className,
  showThreads = true,
}: {
  className?: string
  showThreads?: boolean
}) {
  // Split contexts for better organization
  const { t } = useAppContext()

  // Auth context
  const { user, guest, profile, track, language, allApps, getAppSlug } =
    useAuth()
  const { utilities } = useStyles()

  const styles = useMenuStyles()
  // Navigation context
  const {
    router,
    threads,

    setIsNewChat,
    collaborationStatus,
    setCollaborationStatus,
    pendingCollaborationThreadsCount,
    activeCollaborationThreadsCount,
    isLoadingThreads,
    refetchThreads,
    setIsAccountVisible,
    slug,
    goToThreads,
  } = useNavigationContext()

  // App context
  const { app } = useApp()

  // Platform context
  const { os, isStandalone } = usePlatform()

  // Theme context
  const {
    theme,
    isDark,
    addHapticFeedback,
    reduceMotion: reduceMotionContext,
    setReduceMotion,
    isMobileDevice,
    isDrawerOpen,
    setIsDrawerOpen,
    isSmallDevice,
  } = useTheme()

  const [previousThreads, setPreviousThreads] = useState<typeof threads>({
    threads: [],
    totalCount: 0,
  })

  const toggleMenu = () => {
    addHapticFeedback()
    track({
      name: "menu-toggle",
      props: {
        isDrawerOpen,
        isSmallDevice,
      },
    })
    setIsDrawerOpen(!isDrawerOpen)
  }

  const hasHydrated = useHasHydrated()

  const reload = () => {
    // if (isExtension) return
    // const page = document.querySelector("[data-url]")
    // if (page) {
    //   const attr = page.getAttribute("data-url")
    //   if (!attr) return
    //   const pathname = window.location.pathname
    //   if (pathname !== attr) {
    //     window.location.href = attr
    //   }
    // }
  }

  const timelineListRef = useRef<HTMLDivElement>(null)

  // Custom loading state that waits for actual DOM rendering

  const [hasAnimatedThreads, setHasAnimatedThreads] = useState(false)
  const animateThreads = (
    reduceMotion: boolean = reduceMotionContext,
  ): void => {
    if (typeof window === "undefined") return
    // const menuThreadList = document?.querySelector(".menuThreadList")

    // Check for reduced motion preference
    const prefersReducedMotion =
      reduceMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (prefersReducedMotion) {
      // Just make visible without animation
      const menuThreadList = document?.querySelector(".menuThreadList")
      const menuThreadItems = document?.querySelectorAll(".menuThreadItem")

      if (menuThreadList) {
        ;(menuThreadList as HTMLElement).style.opacity = "1"
      }
      menuThreadItems?.forEach((item) => {
        ;(item as HTMLElement).style.opacity = "1"
      })
    } else {
      // Animate with motion
      animate([
        [".menuThreadList", { opacity: [0, 1] }, { duration: 0 }],
        [
          ".menuThreadItem",
          {
            y: [-10, 0],
            opacity: [0, 1],
            transform: ["translateX(-10px)", "none"],
          },
          {
            delay: stagger(0.05),
            duration: 0.1,
          },
        ],
      ])
      setHasAnimatedThreads(true)
    }
  }

  const innerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isSmallDevice &&
        innerRef.current &&
        !innerRef.current.contains(event.target as Node)
      ) {
        setIsDrawerOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isSmallDevice])

  useEffect(() => {
    isDrawerOpen && animateThreads()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDrawerOpen(!isDrawerOpen)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isDrawerOpen])

  const [lastStarredId, setLastStarredId] = useState<string | null>(null)
  const threadRefs = useRef<{ [id: string]: HTMLDivElement | null }>({})

  useEffect(() => {
    // Function to get or create the meta tag
    const getOrCreateThemeMetaTag = () => {
      let meta = document.querySelector(
        "meta[name='theme-color']",
      ) as HTMLMetaElement
      if (!meta) {
        meta = document.createElement("meta")
        meta.name = "theme-color"
        document.head.appendChild(meta)
      }
      return meta
    }

    const getOrCreateBackgroundMetaTag = () => {
      let meta = document.querySelector(
        "meta[name='background-color']",
      ) as HTMLMetaElement
      if (!meta) {
        meta = document.createElement("meta")
        meta.name = "background-color"
        document.head.appendChild(meta)
      }
      return meta
    }

    const themeMeta = getOrCreateThemeMetaTag()
    themeMeta.content = isDark ? "#000000" : "#ffffff"

    const backgroundMeta = getOrCreateBackgroundMetaTag()
    backgroundMeta.content = isDark ? "#000000" : "#ffffff"
  }, [theme])

  useEffect(() => {
    if (lastStarredId && threadRefs.current[lastStarredId]) {
      threadRefs.current[lastStarredId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      setLastStarredId(null) // reset after scrolling
    }
  }, [threads, lastStarredId])

  useEffect(() => {
    setPreviousThreads(threads)

    if (threads?.threads?.length === 0) return

    const areEqual =
      previousThreads.threads.length === threads.threads.length &&
      previousThreads.threads.every(
        (prev, i) =>
          prev.id === threads.threads[i]?.id &&
          prev.bookmarks?.length === threads.threads[i]?.bookmarks?.length,
      )
    setTimeout(() => {
      ;(!hasAnimatedThreads || !areEqual) && animateThreads()
    }, 150)
  }, [threads, hasAnimatedThreads])

  return (
    <>
      <Div
        className="menu"
        key={isDrawerOpen ? "open" : "closed"}
        ref={innerRef}
        style={{
          ...styles.menu.style,
          ...(isDrawerOpen ? styles.open.style : styles.closed.style),
        }}
      >
        <>
          <Div style={styles.menuHeader.style}>
            {isDrawerOpen ? (
              <>
                <A
                  data-testid="menu-home-button"
                  className={"link"}
                  href={FRONTEND_URL}
                  onClick={(e) => {
                    addHapticFeedback()
                    track({
                      name: "home-click",
                    })
                    if (e.metaKey || e.ctrlKey) {
                      return
                    }
                    e.preventDefault()

                    isSmallDevice ? toggleMenu() : null
                    setIsNewChat(true)
                    reload()
                  }}
                >
                  <Img app={app} size={28} />
                  <Span style={styles.brand.style}>{app?.name || "Vex"}</Span>
                </A>
                <Button
                  className={"link"}
                  onClick={toggleMenu}
                  style={styles.menuButton.style}
                >
                  <PanelRight color={"var(--shade-4)"} size={20} />
                </Button>
              </>
            ) : (
              <Button className={"link"} onClick={toggleMenu}>
                <Img app={app} size={28} />
              </Button>
            )}
          </Div>
          <Div
            style={{
              ...styles.menuContent.style,
              ...(isDrawerOpen && styles.open.style),
              ...(isDrawerOpen && styles.closed.style),
            }}
          >
            <Div style={styles.menuItems.style}>
              <A
                data-testid="new-chat-button"
                href={FRONTEND_URL}
                onClick={(e) => {
                  track({
                    name: "new-chat-click",
                  })
                  if (e.metaKey || e.ctrlKey) {
                    return
                  }
                  e.preventDefault()

                  isSmallDevice ? toggleMenu() : addHapticFeedback()
                  setIsNewChat(true)
                  reload()
                }}
                style={styles.menuItemButton.style}
                className="button transparent"
              >
                <MessageCirclePlus size={18} /> {t("New chat")}
              </A>
              <A
                href={`${FRONTEND_URL}/?incognito=true`}
                onClick={(e) => {
                  track({
                    name: "private-chat-click",
                  })
                  if (e.metaKey || e.ctrlKey) {
                    return
                  }
                  e.preventDefault()

                  isSmallDevice ? toggleMenu() : addHapticFeedback()
                  router.push("/?incognito=true")
                  reload()
                }}
                style={styles.menuItemButton.style}
                className="button transparent"
              >
                <HatGlasses size={18} /> {t("Incognito Chat")}
              </A>
              <A
                href={
                  isStandalone
                    ? undefined
                    : `${app ? getAppSlug(app, "") : ""}/threads`
                }
                onClick={(e) => {
                  track({
                    name: "threads-click-menu",
                  })
                  if (e.metaKey || e.ctrlKey) {
                    return
                  }
                  e.preventDefault()

                  isSmallDevice ? toggleMenu() : addHapticFeedback()
                  goToThreads()
                }}
                style={styles.menuItemButton.style}
                className="button transparent"
              >
                <Search size={18} /> {t("Search chats")}
              </A>
              {showThreads && (
                <Div
                  style={{
                    ...styles.threads.style,
                    ...(isLoadingThreads && styles.loading.style),
                  }}
                >
                  <H4 style={styles.threadsTitle.style}>
                    {collaborationStatus === "active" ? (
                      <>
                        <UsersRound size={15} color="var(--accent-6)" />{" "}
                        {t("Collaborations")}
                      </>
                    ) : collaborationStatus === "pending" ? (
                      <>
                        <UsersRound size={15} color="var(--accent-6)" />{" "}
                        {t("Pending")}
                      </>
                    ) : (
                      <>
                        {(() => {
                          if (!hasHydrated) return null
                          const name = profile?.name || user?.name

                          const isOwner =
                            user &&
                            (!profile || profile?.userName === user?.userName)

                          if (isOwner) {
                            return (
                              <>
                                <Button
                                  className="link"
                                  style={styles.profileButton.style}
                                  onClick={() => {
                                    addHapticFeedback()
                                    isMobileDevice && setIsDrawerOpen(false)
                                    setIsAccountVisible(true)
                                  }}
                                >
                                  <UserRoundCog size={18} />{" "}
                                  <Span
                                    style={{
                                      color: isMobileDevice
                                        ? undefined
                                        : "var(--foreground)",
                                    }}
                                  >
                                    {name || t("Threads")}
                                  </Span>
                                </Button>
                              </>
                            )
                          }

                          return (
                            <>
                              <AtSign size={18} /> {name || t("Threads")}
                            </>
                          )
                        })()}
                      </>
                    )}
                    <Div
                      style={{
                        marginLeft: "auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7.5,
                      }}
                    >
                      {profile && profile.userName !== user?.userName ? (
                        <Button
                          className="link"
                          onClick={() => {
                            setIsNewChat(true)
                          }}
                        >
                          <ArrowLeft color="var(--accent-6)" size={17} />
                        </Button>
                      ) : (
                        <>
                          {activeCollaborationThreadsCount > 0 ? (
                            <>
                              {collaborationStatus === "active" ? (
                                <Button
                                  className="link"
                                  onClick={() => {
                                    setIsNewChat(true)
                                  }}
                                >
                                  <ArrowLeft
                                    color="var(--accent-6)"
                                    size={17}
                                  />
                                </Button>
                              ) : (
                                <Button
                                  title={t("Active Collaborations")}
                                  className="link"
                                  onClick={() => {
                                    addHapticFeedback()

                                    if (guest) {
                                      router.push("/?signIn=register")
                                      return
                                    }
                                    setCollaborationStatus("active")
                                  }}
                                >
                                  <UsersRound
                                    color="var(--accent-1)"
                                    size={17}
                                  />
                                </Button>
                              )}
                            </>
                          ) : null}
                          {!profile && pendingCollaborationThreadsCount > 0 ? (
                            collaborationStatus === "pending" ? (
                              <Button
                                className="link"
                                onClick={() => {
                                  setIsNewChat(true)
                                }}
                              >
                                <ArrowLeft color="var(--accent-6)" size={16} />
                              </Button>
                            ) : (
                              <Button
                                title={t("Pending Collaborations")}
                                className="link"
                                onClick={() => {
                                  addHapticFeedback()
                                  setCollaborationStatus("pending")
                                }}
                              >
                                <UserRoundPlus
                                  color="var(--accent-6)"
                                  size={17}
                                />
                              </Button>
                            )
                          ) : null}
                        </>
                      )}
                    </Div>
                  </H4>
                  {isLoadingThreads ? (
                    <Div>
                      <Loading width={20} />
                    </Div>
                  ) : (
                    <>
                      <Div
                        ref={timelineListRef}
                        className={clsx(styles.threadsList, "menuThreadList")}
                      >
                        {threads.threads.map((thread) => (
                          <Div
                            data-testid="menu-thread-item"
                            style={{
                              ...styles.threadItem.style,
                              paddingRight:
                                collaborationStatus === "pending" ? 0 : 17,
                            }}
                            ref={(el) => {
                              threadRefs.current[thread.id] = el
                            }}
                            className="menuThreadItem"
                            key={`${thread.id}-${thread.bookmarks?.length}`}
                          >
                            {thread.visibility !== "private" ||
                            thread.collaborations?.length ? (
                              <Span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  fontSize: 12,
                                  position: "relative",
                                  marginRight: 3,
                                  top: "1px",
                                }}
                                title={t(thread.visibility)}
                              >
                                {hasThreadNotification({
                                  thread,
                                  user,
                                  guest,
                                }) ? (
                                  <BellDot color="var(--accent-6)" size={13} />
                                ) : thread.collaborations?.length ? (
                                  <UsersRound
                                    color="var(--accent-1)"
                                    size={13}
                                  />
                                ) : thread.visibility === "public" ? (
                                  <LockOpen color="var(--accent-1)" size={13} />
                                ) : thread.visibility === "protected" ? (
                                  <UserLock color="var(--accent-1)" size={13} />
                                ) : null}
                              </Span>
                            ) : null}

                            {(() => {
                              const url = `/threads/${thread.id}`

                              return (
                                <A
                                  data-testid={`thread-link-${thread.id}`}
                                  onClick={(e) => {
                                    track({
                                      name: "thread-click-menu",
                                      props: {
                                        threadId: thread.id,
                                      },
                                    })
                                    if (e.metaKey || e.ctrlKey) {
                                      return
                                    }
                                    e.preventDefault()
                                    isSmallDevice
                                      ? toggleMenu()
                                      : addHapticFeedback()
                                    router.push(url)
                                  }}
                                  href={url}
                                >
                                  {thread.title}
                                </A>
                              )
                            })()}

                            {collaborationStatus === "pending" ? (
                              <CollaborationStatus
                                dataTestId="menu"
                                onSave={() => {
                                  if (threads.totalCount === 1) {
                                    setCollaborationStatus(undefined)
                                  }
                                  refetchThreads()
                                }}
                                style={styles.collaborationStatus.style}
                                thread={thread}
                                isIcon
                              />
                            ) : (
                              <Bookmark
                                dataTestId="menu"
                                onSave={() => {
                                  refetchThreads()
                                }}
                                style={{
                                  ...styles.star.style,
                                  ...(thread.bookmarks?.some(
                                    (b) => b.userId === thread.userId,
                                  ) && styles.starActive.style),
                                }}
                                thread={thread}
                              />
                            )}
                          </Div>
                        ))}
                      </Div>
                      {!isLoadingThreads && threads.threads.length === 0 && (
                        <>
                          <Div style={styles.noThreadsContainer.style}>
                            {t("Nothing here yet")}
                          </Div>
                        </>
                      )}
                      {threads.threads.length
                        ? (() => {
                            const url = `/threads${collaborationStatus ? `?collaborationStatus=${collaborationStatus}` : ""}`

                            return (
                              <Div style={styles.loadMoreButtonContainer.style}>
                                <A
                                  href={url}
                                  data-testid="load-more-threads-menu"
                                  onClick={(e) => {
                                    addHapticFeedback()

                                    track({
                                      name: "load-more-threads-menu",
                                    })

                                    if (e.metaKey || e.ctrlKey) {
                                      return
                                    }
                                    e.preventDefault()
                                    isSmallDevice ? toggleMenu() : null
                                    router.push(url)
                                  }}
                                  className="button transparent small"
                                  style={styles.loadMoreButton.style}
                                >
                                  <LoaderCircle size={14} /> {t("Load more")}
                                </A>
                              </Div>
                            )
                          })()
                        : null}
                      {threads.threads.length < 2 && <EmptyStateTips />}
                    </>
                  )}
                </Div>
              )}
            </Div>
          </Div>
          <Div style={styles.footer.style}>
            <Div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontSize: "0.7rem",
                color: "var(--shade-7)",
              }}
            >
              <Img icon="hamster" showLoading={false} width={26} height={26} />
              {hasHydrated ? (
                <>
                  {new Date().getFullYear()}
                  &#169;
                </>
              ) : null}
              <Button
                style={{
                  marginLeft: "auto",
                  gap: 7.5,
                  color: "#f87171",
                  fontSize: "0.8rem",
                }}
                onClick={() => {
                  if (checkIsExtension()) {
                    BrowserInstance?.runtime?.sendMessage({
                      action: "openInSameTab",
                      url: `${FRONTEND_URL}/affiliate`,
                    })

                    isSmallDevice && toggleMenu()

                    return
                  }
                  router.push("/affiliate")
                  isSmallDevice && toggleMenu()
                }}
                className={"link"}
              >
                {"Amsterdam"}
                <Img icon="heart" width={22} height={22} />
              </Button>
            </Div>

            <Div style={styles.colorSchemeContainer.style}>
              <ColorScheme style={styles.colorScheme.style} />
              {hasHydrated && (
                <Button
                  title={t("Motion")}
                  onClick={() => {
                    reduceMotionContext && animateThreads(false)

                    setReduceMotion(!reduceMotionContext)
                  }}
                  style={{
                    ...styles.reduceMotionButton.style,
                    marginLeft: "auto",
                    color: !reduceMotionContext
                      ? "var(--accent-6)"
                      : "var(--shade-3)",
                  }}
                  className={"link"}
                >
                  <Tornado size={18} />
                  Motion
                </Button>
              )}
            </Div>

            <Div style={styles.bottom.style}>
              <A
                openInNewTab
                href={`https://wannathis.one/?via=iliyan&ref=${app?.slug}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  alignSelf: "flex-start",
                  gap: 3,
                  paddingInline: 8.5,
                }}
                target="_blank"
                rel="noopener noreferrer"
                className="button transparent"
              >
                <WannathisIcon width={18} height={18} />
                Wannathis
              </A>

              <ThemeSwitcher />
              {hasHydrated && (
                <span style={{ marginLeft: "auto", fontSize: 12 }}>
                  v{VERSION}
                </span>
              )}
            </Div>
          </Div>
        </>
      </Div>
    </>
  )
}

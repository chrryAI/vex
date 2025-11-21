"use client"

import React, { useEffect, useState } from "react"
import Skeleton from "./Skeleton"
import {
  useApp,
  useAuth,
  useData,
  useNavigationContext,
} from "./context/providers"
import Img from "./Image"
import { useAppContext } from "./context/AppContext"
import { appWithStore } from "./types"
import { Div, H3, H4, P, Span, useTheme } from "./platform"
import { useStoreStyles } from "./Store.styles"
import { Sparkles, ArrowRight } from "./icons"
import A from "./A"
import { useStoreMetadata } from "./hooks/useMetadata"

export default function Store({
  compact,
  slug,
}: {
  compact?: boolean
  slug?: string
}) {
  const { FRONTEND_URL } = useData()

  const { isMobileDevice } = useTheme()

  const { router, setIsNewChat, pathname, searchParams } =
    useNavigationContext()

  const { getAppSlug } = useAuth()

  const { track, allApps } = useAuth()

  const { currentStore } = useApp()

  const store = slug
    ? allApps.find((app) => app.slug === slug)?.store
    : currentStore

  const apps = store?.apps

  // Get the base app - either from store.app or find it in the apps array

  const { t } = useAppContext()

  // Filter apps that belong to this store (exclude Chrry itself)
  const storeApps = apps

  const [selectedApp, setSelectedAppInternal] = useState<
    appWithStore | undefined
  >(
    storeApps?.find(
      (app) => app.slug === searchParams.get("app") || app.id === store?.appId,
    ),
  )

  const setSelectedApp = (app: appWithStore | undefined) => {
    if (!app?.store?.slug) return
    if (!app?.slug) return

    setSelectedAppInternal(app)

    !slug && router.push(`/${app.store.slug}?app=${app.slug}`)
  }

  useEffect(() => {
    if (store) {
      track({
        name: "Store View",
        props: {
          storeId: store.id,
          storeName: store.name,
          storeSlug: store.slug,
          appCount: storeApps?.length || 0,
        },
      })
    }
  }, [store?.id, track])

  useEffect(() => {
    if (selectedApp) {
      track({
        name: "Store App Selected",
        props: {
          appId: selectedApp.id,
          appName: selectedApp.name,
          appSlug: selectedApp.slug,
          storeId: store?.id,
          storeName: store?.name,
        },
      })
    }
  }, [selectedApp?.id, store?.id, track])

  // Dynamically update page metadata for client-side navigation
  useStoreMetadata(store)

  const styles = useStoreStyles()

  const { margin } = styles.lifeOS.style

  const render = () => {
    if (!store?.app) {
      return null
    }

    return (
      <Div
        style={{
          ...styles.lifeOS.style,
          margin: compact ? 0 : margin,
        }}
      >
        {!compact && (
          <Div style={{ ...styles.header.style }}>
            <div style={{ ...styles.headerIcons.style }}>
              <Img
                showLoading={false}
                src={`${FRONTEND_URL}/images/pacman/space-invader.png`}
                alt="Space Invader"
                size={28}
              />
              <Img
                showLoading={false}
                src={`${FRONTEND_URL}/images/pacman/pacman.png`}
                alt="Pacman"
                size={28}
              />

              <A href={"/blossom"}>
                <Img logo="blossom" size={32} />
              </A>
              <Img
                style={{ marginLeft: "auto" }}
                showLoading={false}
                src={`${FRONTEND_URL}/images/pacman/heart.png`}
                alt="Heart"
                size={28}
              />
            </div>
            <h1 style={{ ...styles.title.style }}>
              <span style={{ ...styles.titleText.style }}>
                <A
                  href={store.app ? getAppSlug(store.app) : "#"}
                  onClick={(e) => {
                    e.preventDefault()

                    if (store.app) {
                      setIsNewChat(true, getAppSlug(store.app))
                    }
                    if (e.metaKey || e.ctrlKey) {
                      return
                    }
                  }}
                  className={"link"}
                >
                  {store?.name}
                </A>{" "}
                - {t(store?.title || "")}
              </span>
            </h1>
            <p style={{ ...styles.intro.style }}>
              {t(store?.description || "")}
            </p>
          </Div>
        )}
        <Div style={styles.createAgent.style}>
          <button
            onClick={() => {
              router.push("/?part=highlights")
            }}
            className="inverted"
          >
            <Sparkles size={16} color="var(--accent-1)" />
            {t("Create Your Agent")}
          </button>
        </Div>
        <Div style={styles.content.style}>
          <Div style={styles.apps.style}>
            {storeApps?.map((app) => (
              <Div
                key={app.id}
                style={{
                  ...styles.app.style,
                  ...(selectedApp?.id === app.id && styles.appSelected.style),
                }}
                onClick={() => setSelectedApp(app)}
              >
                <span style={{ ...styles.badge.style }}>{t("live")}</span>
                <Img
                  style={{ ...styles.appImage.style }}
                  app={app}
                  alt={app.name}
                  size={isMobileDevice ? 40 : 80}
                />
                <Div style={{ ...styles.appInfo.style }}>
                  <Span style={{ ...styles.appName.style }}>
                    {app.icon} {app.name}
                  </Span>
                  <Span style={{ ...styles.appSubtitle.style }}>
                    {t(app.subtitle || "")}
                  </Span>
                </Div>
              </Div>
            ))}
          </Div>

          <Div key={selectedApp?.id} style={styles.footer.style}>
            {selectedApp && (
              <Div style={styles.appDetails.style}>
                <H3 style={styles.appTitle.style}>
                  {selectedApp.icon} {selectedApp.name}
                  <A
                    href={getAppSlug(selectedApp)}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey) {
                        return
                      }
                      e.preventDefault()
                      setIsNewChat(true, getAppSlug(selectedApp))
                    }}
                    style={styles.tryItNow.style}
                  >
                    <ArrowRight size={16} color="var(--accent-6)" />
                    {t("Try it now!")}
                  </A>
                </H3>
                <P style={styles.subtitle.style}>
                  {t(selectedApp.title || "")}
                </P>
                <P style={styles.description.style}>
                  {t(selectedApp.description || "")}
                </P>
                {Array.isArray(selectedApp.featureList) &&
                  selectedApp.featureList.length > 0 && (
                    <Div>
                      <H4 style={styles.featuresH4.style}>
                        {t("Key Features")}
                      </H4>
                      <Div>
                        {selectedApp.featureList.map((feature, index) => (
                          <P style={styles.feature.style} key={index}>
                            <Sparkles
                              size={16}
                              color="var(--accent-1)"
                              fill="var(--accent-1)"
                            />
                            {t(feature)}
                          </P>
                        ))}
                        <P style={styles.feature.style}>
                          <A
                            href={getAppSlug(selectedApp)}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey) {
                                return
                              }
                              e.preventDefault()
                              setIsNewChat(true, getAppSlug(selectedApp))
                            }}
                            className={"link"}
                          >
                            <ArrowRight size={16} color="var(--accent-6)" />
                            {t("Try it now!")}
                          </A>
                        </P>
                      </Div>
                    </Div>
                  )}
              </Div>
            )}
          </Div>
        </Div>
        {!compact && (
          <Div style={styles.tetris.style}>
            <Div style={{ display: "flex", gap: "1rem" }}>
              <A href={`/blossom`}>
                <Img logo="blossom" size={28} /> Blossom
              </A>
              <Img
                showLoading={false}
                src={`${FRONTEND_URL}/images/pacman/tetris1.png`}
                alt="Tetris 1"
                width={28}
                height={28}
              />
              <Img
                showLoading={false}
                src={`${FRONTEND_URL}/images/pacman/tetris2.png`}
                alt="Tetris 2"
                width={28}
                height={28}
              />
            </Div>
          </Div>
        )}
      </Div>
    )
  }

  if (compact) {
    return render()
  }

  if (!store?.app) {
    return null
  }

  return <Skeleton>{render()}</Skeleton>
}
